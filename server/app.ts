import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { requirePassword } from "./auth-middleware";
import { log } from "./log";

// Also applied to static files on Vercel (script/build-vercel.mjs)
export const CONTENT_SECURITY_POLICY = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
};

// Builds the Express app (API, sessions, auth). Shared by the long-running
// server (server/index.ts) and the Vercel serverless function (api/index.ts).
export async function createApp() {
  // Set NODE_ENV to production if not set (for deployment compatibility)
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  // Validate required environment variables for production
  if (process.env.NODE_ENV === 'production') {
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      console.error('Please ensure all required environment variables are set before starting the application.');
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set in production');
  }

  const app = express();
  // Hosting platforms terminate HTTPS at a proxy; trust it so secure cookies work
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  // Security headers. The CSP is production-only because Vite's dev server injects inline scripts.
  app.use(helmet({
    contentSecurityPolicy: isProduction ? { directives: CONTENT_SECURITY_POLICY } : false,
  }));
  app.use(express.json({ limit: "100kb" }));

  // Configure session store
  const PgSession = ConnectPgSimple(session);

  // Create session store - use PostgreSQL when DATABASE_URL is available, MemoryStore for local development
  const createSessionStore = () => {
    // Use PostgreSQL session store if DATABASE_URL is available (deployed or production environment)
    if (process.env.DATABASE_URL) {
      try {
        console.log('Using PostgreSQL session store for persistent sessions');
        return new PgSession({
          conString: process.env.DATABASE_URL,
          tableName: 'session', // Table to store sessions
          createTableIfMissing: true, // Automatically create the session table
        });
      } catch (error) {
        console.warn('Failed to create PostgreSQL session store, falling back to MemoryStore:', error);
        return new session.MemoryStore();
      }
    } else {
      // Use MemoryStore only for local development without database
      console.log('Using MemoryStore for development sessions');
      return new session.MemoryStore();
    }
  };

  // Configure session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'local-dev-only-secret',
    store: createSessionStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset the expiration on each request
    cookie: {
      secure: 'auto', // HTTPS-only cookie when the request came in over HTTPS
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax' // Allow cross-site requests for login
    }
  }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  // Password protection for everything except login, health and static assets
  app.use(requirePassword);

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error details in production for monitoring
    if (process.env.NODE_ENV === 'production') {
      console.error('Server error:', {
        status,
        message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
    }

    // Don't leak internal error details (SQL, stack messages) to the browser
    res.status(status).json({ message: isProduction && status >= 500 ? "Internal Server Error" : message });

    // Don't throw in production to prevent server crashes
    if (process.env.NODE_ENV !== 'production') {
      throw err;
    }
  });

  return { app, server };
}
