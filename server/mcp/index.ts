// Remote MCP server at /mcp, so apps like Claude can use MealMaster as a connector.
//
// Sign-in is OAuth 2.1 (what MCP clients expect): the app registers itself,
// sends the person to our sign-in page, they enter their family (kitchen)
// password, and the app gets tokens for that one kitchen. The SDK's router
// handles discovery, registration, PKCE and the token endpoint; this file adds
// the password form and the MCP endpoint itself.

import express, { type Express, type Request, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { findFamilyByPassword, isValidPasswordInput } from "../auth-middleware";
import { KitchenOAuthProvider, MCP_SCOPE, openSignInRequest, type SignInRequest } from "./oauth-provider";
import { renderKitchenSignIn, SIGN_IN_PATH } from "./sign-in-page";
import { createKitchenMcpServer } from "./tools";

export const MCP_PATH = "/mcp";

const provider = new KitchenOAuthProvider();

// OAuth metadata has to name this server's own URL. PUBLIC_URL pins it (set it in
// production); otherwise it follows the request, which also covers preview deploys.
function baseUrl(req: Request): URL {
  return new URL(process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`);
}

interface OriginHandlers {
  oauth: RequestHandler;
  bearer: RequestHandler;
}
const handlersByOrigin = new Map<string, OriginHandlers>();

function handlersFor(req: Request): OriginHandlers | undefined {
  const base = baseUrl(req);
  let handlers = handlersByOrigin.get(base.origin);
  if (!handlers) {
    const resourceServerUrl = new URL(MCP_PATH, base);
    try {
      handlers = {
        oauth: mcpAuthRouter({
          provider,
          issuerUrl: base,
          resourceServerUrl,
          resourceName: "MealMaster",
          scopesSupported: [MCP_SCOPE],
          // The SDK's rate limiters are created here, on the first request for each origin
          // (then cached), which express-rate-limit would otherwise warn about
          authorizationOptions: { rateLimit: { validate: { creationStack: false } } },
          clientRegistrationOptions: { rateLimit: { validate: { creationStack: false } } },
          tokenOptions: { rateLimit: { validate: { creationStack: false } } },
          revocationOptions: { rateLimit: { validate: { creationStack: false } } },
        }),
        bearer: requireBearerAuth({
          verifier: provider,
          resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
        }),
      };
    } catch (error) {
      // OAuth requires HTTPS (except on localhost); plain-HTTP hosts get no MCP endpoint
      console.warn(`MCP disabled for ${base.origin}:`, (error as Error).message);
      return undefined;
    }
    if (handlersByOrigin.size < 20) handlersByOrigin.set(base.origin, handlers);
  }
  return handlers;
}

function redirectWith(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.href;
}

// Same budget as the app's login form: 10 failed tries per 15 minutes
const signInRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const request = openSignInRequest(req.body?.request);
    if (request) return renderKitchenSignIn(res.status(429), request, "Too many tries. Wait 15 minutes, then try again.");
    res.status(429).type("text").send("Too many tries. Wait 15 minutes, then try again.");
  },
});

const expiredMessage = "This sign-in page has expired. Go back to the app and connect MealMaster again.";

async function handleSignIn(req: Request, res: express.Response) {
  const request: SignInRequest | undefined = openSignInRequest(req.body?.request);
  if (!request) return res.status(400).type("text").send(expiredMessage);

  // The request is signed, but the app may have been removed since the page was shown
  const client = await provider.clientsStore.getClient(request.clientId);
  if (!client || !client.redirect_uris.includes(request.redirectUri)) {
    return res.status(400).type("text").send(expiredMessage);
  }

  if (req.body.decision !== "allow") {
    return res.redirect(302, redirectWith(request.redirectUri, { error: "access_denied", state: request.state }));
  }

  const { password } = req.body;
  if (!isValidPasswordInput(password)) {
    return renderKitchenSignIn(res, request, "Enter your family password.");
  }
  const family = await findFamilyByPassword(password);
  if (!family) {
    return renderKitchenSignIn(res, request, "That password doesn't match any family. Check it and try again.");
  }

  const code = await provider.createAuthorizationCode(request, family.id);
  res.redirect(302, redirectWith(request.redirectUri, { code, state: request.state }));
}

export function registerMcp(app: Express) {
  // Discovery, client registration, /authorize, /token, /revoke
  app.use((req, res, next) => {
    const handlers = handlersFor(req);
    if (!handlers) return next();
    handlers.oauth(req, res, next);
  });

  app.post(SIGN_IN_PATH, express.urlencoded({ extended: false, limit: "20kb" }), signInRateLimit, (req, res, next) => {
    handleSignIn(req, res).catch(next);
  });

  // Stateless Streamable HTTP: a fresh server per request, so it runs on serverless hosts
  app.post(
    MCP_PATH,
    (req, res, next) => {
      const handlers = handlersFor(req);
      if (!handlers) return res.status(404).json({ message: "MCP needs HTTPS" });
      handlers.bearer(req, res, next);
    },
    async (req, res) => {
      const familyId = req.auth?.extra?.familyId;
      if (typeof familyId !== "number") return res.status(401).json({ message: "Token has no kitchen" });

      const server = createKitchenMcpServer(familyId);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("MCP request failed:", error);
        if (!res.headersSent) {
          res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
        }
      }
    },
  );

  // No server-to-client streams or sessions in stateless mode
  app.all(MCP_PATH, (_req, res) => {
    res.status(405).set("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
  });
}
