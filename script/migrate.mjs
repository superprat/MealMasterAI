// Applies the SQL files in migrations/ that the database hasn't seen yet, in name order.
//
//   node script/migrate.mjs          apply pending migrations to DATABASE_URL
//   node script/migrate.mjs --dry    list what would run, change nothing
//
// Each file runs in its own transaction and is recorded in the schema_migrations table,
// so a failed file leaves the database as it was and the next run retries it.
// A Postgres advisory lock stops two builds from migrating at once.
//
// Write migrations by hand (never `drizzle-kit push` against production: it would drop
// the login session table, which isn't in shared/schema.ts). Keep them additive and
// re-runnable where you can (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS),
// because the old deployment keeps serving traffic until the new one goes live.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import pg from "pg";
import ws from "ws";

const dir = path.resolve(import.meta.dirname, "../migrations");
const dryRun = process.argv.includes("--dry");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

// Same driver choice as server/db.ts
const isNeon = /\.neon\.tech|\.neon\.build/.test(connectionString);
if (isNeon) neonConfig.webSocketConstructor = ws;
const pool = isNeon ? new NeonPool({ connectionString }) : new pg.Pool({ connectionString });

const files = readdirSync(dir)
  .filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f))
  .sort();

const client = await pool.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

  let applied = 0;
  for (const file of files) {
    await client.query("BEGIN");
    try {
      // Held until COMMIT/ROLLBACK, so it also works through Neon's transaction pooler
      await client.query("SELECT pg_advisory_xact_lock(hashtext('mealmaster-migrations'))");
      const { rowCount } = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (rowCount) {
        await client.query("ROLLBACK");
        continue;
      }
      if (dryRun) {
        console.log(`migrate: would apply ${file}`);
        await client.query("ROLLBACK");
        continue;
      }
      await client.query(readFileSync(path.join(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`migrate: applied ${file}`);
      applied++;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`migrate: ${file} failed, nothing from it was applied`);
      throw error;
    }
  }
  if (!dryRun) console.log(applied ? `migrate: ${applied} applied` : "migrate: database is up to date");
} finally {
  client.release();
  await pool.end();
}
