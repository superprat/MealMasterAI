import type { Response } from "express";
import { CONTENT_SECURITY_POLICY } from "../app-security";
import { sealSignInRequest, type SignInRequest } from "./oauth-provider";

export const SIGN_IN_PATH = "/oauth/kitchen-sign-in";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Browsers apply form-action to the redirect after a form post, so the page
// must allow the app's redirect URI or the hand-back to the app is blocked.
function redirectSource(redirectUri: string): string {
  const url = new URL(redirectUri);
  return url.protocol === "http:" || url.protocol === "https:" ? url.origin : url.protocol;
}

function cspFor(redirectUri: string): string {
  const directives: Record<string, string[]> = {
    ...CONTENT_SECURITY_POLICY,
    formAction: [...CONTENT_SECURITY_POLICY.formAction, redirectSource(redirectUri)],
  };
  return Object.entries(directives)
    .map(([key, values]) => `${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())} ${values.join(" ")}`)
    .join("; ");
}

// Colours copied from client/src/index.css (:root) so this page matches the app's login screen
const STYLES = `
:root {
  --background: oklch(0.972 0.013 84); --foreground: oklch(0.27 0.028 50);
  --card: oklch(0.988 0.007 84); --muted-foreground: oklch(0.5 0.03 60);
  --border: oklch(0.885 0.02 75); --input: oklch(0.86 0.022 75);
  --primary: oklch(0.565 0.135 42); --primary-foreground: oklch(0.985 0.01 84);
  --secondary: oklch(0.93 0.022 78); --secondary-foreground: oklch(0.3 0.03 50);
  --destructive: oklch(0.51 0.17 25); --ring: oklch(0.565 0.135 42); --radius: 0.625rem;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: var(--background); color: var(--foreground);
  font-family: Figtree, ui-sans-serif, system-ui, sans-serif; font-size: 1rem; line-height: 1.5; padding: 3rem 1rem; }
main { width: 100%; max-width: 24rem; }
.brand { font-family: "Young Serif", Georgia, serif; font-size: 1.5rem; margin-bottom: 2.5rem; }
.brand span { color: var(--primary); }
h1 { font-family: "Young Serif", Georgia, serif; font-weight: 400; font-size: 1.875rem; line-height: 1.2; margin: 0; }
p { margin: 0.5rem 0 0; color: var(--muted-foreground); }
p strong { color: var(--foreground); font-weight: 600; }
form { margin-top: 2rem; }
label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem; }
input[type=password] { width: 100%; height: 2.75rem; padding: 0 0.75rem; font: inherit; color: inherit;
  background: var(--card); border: 1px solid var(--input); border-radius: calc(var(--radius) - 2px); }
input[aria-invalid=true] { border-color: var(--destructive); }
input:focus-visible, button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.error { margin-top: 0.5rem; font-size: 0.875rem; color: var(--destructive); }
/* Allow comes first in the markup so Enter submits it; shown on the right */
.actions { display: flex; flex-direction: row-reverse; gap: 0.75rem; margin-top: 1.25rem; }
button { flex: 1; height: 2.75rem; font: inherit; font-weight: 500; border: 0; border-radius: calc(var(--radius) - 2px); cursor: pointer; }
.allow { background: var(--primary); color: var(--primary-foreground); }
.cancel { background: var(--secondary); color: var(--secondary-foreground); }
@media (hover: hover) { .allow:hover { filter: brightness(0.94); } .cancel:hover { filter: brightness(0.97); } }
.note { margin-top: 2rem; font-size: 0.875rem; }
`;

export function renderKitchenSignIn(res: Response, request: SignInRequest, error?: string) {
  const appName = escapeHtml(request.clientName?.trim() || "An app");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Connect to your kitchen · MealMaster</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500&family=Young+Serif&display=swap">
<style>${STYLES}</style>
</head>
<body>
<main>
  <div class="brand">Meal<span>Master</span></div>
  <h1>Connect to your kitchen</h1>
  <p><strong>${appName}</strong> wants to read and change your recipes, meal plans and daily targets. Enter your family password to allow it.</p>
  <form method="post" action="${SIGN_IN_PATH}" novalidate>
    <input type="hidden" name="request" value="${escapeHtml(sealSignInRequest(request))}">
    <label for="password">Family password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" autofocus required
      ${error ? 'aria-invalid="true" aria-describedby="password-error"' : ""}>
    ${error ? `<p id="password-error" class="error" role="alert">${escapeHtml(error)}</p>` : ""}
    <div class="actions">
      <button class="allow" type="submit" name="decision" value="allow">Allow</button>
      <button class="cancel" type="submit" name="decision" value="deny" formnovalidate>Cancel</button>
    </div>
  </form>
  <p class="note">It can only see the kitchen this password opens. Signing in to MealMaster in your browser isn't affected.</p>
</main>
</body>
</html>`;

  res
    .status(error ? 401 : 200)
    .set({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": cspFor(request.redirectUri),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    })
    .send(html);
}
