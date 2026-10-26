import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/app";

// Vercel serverless entry: every /api/* request is handled by the same Express app.
// The app is built once per warm instance and reused across requests.
const appReady = createApp().then(({ app }) => app);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appReady;
  app(req as any, res as any);
}
