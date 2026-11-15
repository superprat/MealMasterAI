import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Response } from "express";
import { and, eq, gt, lt } from "drizzle-orm";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidGrantError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { db } from "../db";
import { oauthClients, oauthCodes, oauthTokens } from "../../shared/schema";
import { renderKitchenSignIn } from "./sign-in-page";

const CODE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60;
// How long the sign-in page stays valid before the person has to start again
const SIGN_IN_REQUEST_TTL_MS = 15 * 60 * 1000;

export const MCP_SCOPE = "kitchen";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const newSecret = () => randomBytes(32).toString("base64url");
const secondsFromNow = (s: number) => new Date(Date.now() + s * 1000);

function signingKey(): string {
  return process.env.SESSION_SECRET || "local-dev-only-secret";
}

// The sign-in page carries the authorization request in a signed hidden field,
// so the request can't be altered between showing the page and submitting it.
export interface SignInRequest {
  clientId: string;
  clientName?: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scopes: string[];
  resource?: string;
  issuedAt: number;
}

export function sealSignInRequest(request: SignInRequest): string {
  const body = Buffer.from(JSON.stringify(request)).toString("base64url");
  const mac = createHmac("sha256", signingKey()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function openSignInRequest(sealed: unknown): SignInRequest | undefined {
  if (typeof sealed !== "string") return undefined;
  const [body, mac] = sealed.split(".");
  if (!body || !mac) return undefined;
  const expected = createHmac("sha256", signingKey()).update(body).digest("base64url");
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return undefined;
  try {
    const request = JSON.parse(Buffer.from(body, "base64url").toString()) as SignInRequest;
    if (Date.now() - request.issuedAt > SIGN_IN_REQUEST_TTL_MS) return undefined;
    return request;
  } catch {
    return undefined;
  }
}

class ClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string) {
    const [row] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId));
    return row?.info as OAuthClientInformationFull | undefined;
  }

  // The SDK fills in client_id (and a secret for confidential clients) before calling this
  async registerClient(client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">) {
    const full = client as OAuthClientInformationFull;
    await db.insert(oauthClients).values({ clientId: full.client_id, info: full });
    return full;
  }
}

export class KitchenOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new ClientsStore();

  // Step 1: show the "connect to your kitchen" page
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const request: SignInRequest = {
      clientId: client.client_id,
      clientName: client.client_name,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state,
      scopes: params.scopes?.length ? params.scopes : [MCP_SCOPE],
      resource: params.resource?.href,
      issuedAt: Date.now(),
    };
    renderKitchenSignIn(res, request);
  }

  // Step 2: the right kitchen password was entered; make a one-time code
  async createAuthorizationCode(request: SignInRequest, familyId: number): Promise<string> {
    const code = newSecret();
    await db.insert(oauthCodes).values({
      codeHash: sha256(code),
      clientId: request.clientId,
      familyId,
      codeChallenge: request.codeChallenge,
      redirectUri: request.redirectUri,
      scopes: request.scopes,
      resource: request.resource ?? null,
      expiresAt: secondsFromNow(CODE_TTL_SECONDS),
    });
    return code;
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string): Promise<string> {
    const [row] = await db
      .select()
      .from(oauthCodes)
      .where(and(eq(oauthCodes.codeHash, sha256(code)), eq(oauthCodes.clientId, client.client_id)));
    if (!row || row.expiresAt < new Date()) throw new InvalidGrantError("Invalid or expired authorization code");
    return row.codeChallenge;
  }

  // Step 3: swap the code for tokens. Deleting it first makes it single-use.
  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
    _codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    const [row] = await db
      .delete(oauthCodes)
      .where(and(eq(oauthCodes.codeHash, sha256(code)), eq(oauthCodes.clientId, client.client_id)))
      .returning();
    if (!row || row.expiresAt < new Date()) throw new InvalidGrantError("Invalid or expired authorization code");
    if (redirectUri !== undefined && redirectUri !== row.redirectUri) {
      throw new InvalidGrantError("redirect_uri does not match the one used to authorize");
    }
    await this.cleanUpExpired();
    return this.issueTokens(client.client_id, row.familyId, row.scopes, row.resource);
  }

  // Refresh tokens rotate: each one works once
  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const [row] = await db
      .delete(oauthTokens)
      .where(
        and(
          eq(oauthTokens.tokenHash, sha256(refreshToken)),
          eq(oauthTokens.kind, "refresh"),
          eq(oauthTokens.clientId, client.client_id),
        ),
      )
      .returning();
    if (!row || row.expiresAt < new Date()) throw new InvalidGrantError("Invalid or expired refresh token");
    return this.issueTokens(client.client_id, row.familyId, row.scopes, row.resource);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const [row] = await db
      .select()
      .from(oauthTokens)
      .where(
        and(
          eq(oauthTokens.tokenHash, sha256(token)),
          eq(oauthTokens.kind, "access"),
          gt(oauthTokens.expiresAt, new Date()),
        ),
      );
    if (!row) throw new InvalidTokenError("Invalid or expired access token");
    return {
      token,
      clientId: row.clientId,
      scopes: row.scopes,
      expiresAt: Math.floor(row.expiresAt.getTime() / 1000),
      resource: row.resource ? new URL(row.resource) : undefined,
      extra: { familyId: row.familyId },
    };
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    await db
      .delete(oauthTokens)
      .where(and(eq(oauthTokens.tokenHash, sha256(request.token)), eq(oauthTokens.clientId, client.client_id)));
  }

  private async issueTokens(
    clientId: string,
    familyId: number,
    scopes: string[],
    resource: string | null,
  ): Promise<OAuthTokens> {
    const accessToken = newSecret();
    const refreshToken = newSecret();
    const common = { clientId, familyId, scopes, resource };
    await db.insert(oauthTokens).values([
      { ...common, tokenHash: sha256(accessToken), kind: "access", expiresAt: secondsFromNow(ACCESS_TOKEN_TTL_SECONDS) },
      { ...common, tokenHash: sha256(refreshToken), kind: "refresh", expiresAt: secondsFromNow(REFRESH_TOKEN_TTL_SECONDS) },
    ]);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    };
  }

  private async cleanUpExpired() {
    const now = new Date();
    await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now));
    await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now));
  }
}
