// Builds the app in Vercel's Build Output API v3 format (.vercel/output):
//   static/           the Vite-built front end, served from Vercel's CDN
//   functions/api.func one bundled Node function running the Express API
// https://vercel.com/docs/build-output-api/v3
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".vercel/output");
const funcDir = path.join(out, "functions/api.func");
const require = createRequire(import.meta.url);

rmSync(out, { recursive: true, force: true });
mkdirSync(funcDir, { recursive: true });

// 1. Front end
execSync("npx vite build", { cwd: root, stdio: "inherit" });
cpSync(path.join(root, "dist/public"), path.join(out, "static"), { recursive: true });

// 2. API function, bundled with all dependencies so it needs no node_modules
await build({
  entryPoints: [path.join(root, "api/index.ts")],
  outfile: path.join(funcDir, "index.cjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  // Optional native add-ons that pg and ws load only if present
  external: ["pg-native", "bufferutil", "utf-8-validate"],
  // Expose the default export as the module itself for Vercel's Node launcher
  footer: { js: "module.exports = module.exports.default || module.exports;" },
  logLevel: "info",
});

// connect-pg-simple reads table.sql from next to its own file to create the session table
cpSync(require.resolve("connect-pg-simple/table.sql"), path.join(funcDir, "table.sql"));

writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.cjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      maxDuration: 60, // AI suggestions can take 10-30s
    },
    null,
    2,
  ),
);

// 3. Routing: API and health check go to the function, everything else is the SPA
writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/api/(.*)$", dest: "/api" },
        { src: "^/health$", dest: "/api" },
        { handle: "filesystem" },
        { src: "^/(.*)$", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log(`Vercel output written to ${path.relative(root, out)}`);
