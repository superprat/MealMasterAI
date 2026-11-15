# MealMasterAI

A family meal planner. Plan breakfast, lunch, snack and dinner in a rolling 4‑day view, track calories and macros against daily targets, keep a shared recipe library, and ask Claude for meal suggestions.

Each family logs in with its own password and sees only its own meal plans and targets. The recipe library is shared by all families.

**Stack:** React + Vite + Tailwind/shadcn on the front end, Express + Drizzle ORM on the back end, PostgreSQL for storage, Anthropic Claude for AI suggestions.

## Run locally

Requirements: Node 20+ and a PostgreSQL database (local, Docker, Neon, Supabase…).

```bash
npm install
cp .env.example .env    # then fill in the values
docker run -d --name mealmaster-pg -e POSTGRES_PASSWORD=localdev -e POSTGRES_DB=mealmaster -p 54329:5432 postgres:16
export $(grep -v '^#' .env | xargs)
npm run db:push         # create tables
npx tsx server/seed-database.ts   # optional: sample recipes + families from SEED_FAMILIES
npm run dev             # http://localhost:5000
```

On macOS, port 5000 is often taken by AirPlay Receiver. Set `PORT=5050` if it is.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. Neon URLs use Neon's driver; anything else uses node-postgres. |
| `SESSION_SECRET` | yes in production | Long random string used to sign login cookies. |
| `ANTHROPIC_API_KEY` | for AI features | Enables “Generate Plan” and AI recipe macros. |
| `ANTHROPIC_MODEL` | no | Overrides the Claude model (default `claude-haiku-5-5`). |
| `SEED_FAMILIES` | no | `Name:password,Other:password2`. Used only by the seed script. |
| `PORT` | no | Defaults to 5000. |

### Restore a database backup

```bash
psql "$DATABASE_URL" < mealmaster-backup.sql
```

Backups contain family passwords. Never commit them; `*.sql` is ignored by git.

## Deploy

### Vercel (free, recommended)

`npm run build:vercel` writes [Build Output API](https://vercel.com/docs/build-output-api/v3) files to `.vercel/output`: the front end as static files, and the whole Express API bundled into one Node function (`api/index.ts`). `vercel.json` tells Vercel to use that build.

1. On [vercel.com](https://vercel.com/new), import this GitHub repo. Leave the build settings as they are.
2. In the project's **Storage** tab, add a **Neon** Postgres database. This sets `DATABASE_URL`.
3. In **Settings → Environment Variables**, add `SESSION_SECRET` (a long random string) and `ANTHROPIC_API_KEY`.
4. Set up the database, either from a backup (this creates the tables too) or empty:
   ```bash
   psql "<neon url>" < mealmaster-backup.sql        # restore your data
   DATABASE_URL="<neon url>" npm run db:push         # or: start with empty tables
   ```
5. Redeploy. Every push to `main` deploys automatically after that.

### Any Node host

The app can also run as a single Node process that serves both the API and the built front end:

```bash
npm run build
npm start
```

Any host that runs Node and gives you a Postgres database works (Railway, Render + Neon, Fly.io, a VPS…). Set the environment variables above on the host. HTTPS is detected automatically behind the host's proxy, so login cookies are marked secure.

## AI agents (WebMCP)

The app exposes its features as [WebMCP](https://github.com/webmachinelearning/webmcp) tools through `navigator.modelContext`, so an AI agent working in the browser can plan meals without clicking through the UI. The tools live in `client/src/lib/webmcp.ts` and are registered on every page, including `/login`. They call the same `/api` routes as the UI with the same session cookie, and the open page updates as the agent makes changes.

An agent can work in a kitchen two ways:

- **Already signed in:** if the person has signed in, the tools act on that kitchen.
- **With a password:** the agent calls `sign_in_to_kitchen` with a kitchen's password. The password decides which kitchen opens, the same as the login form, and the same login rate limit applies.

| Tool | What it does |
| --- | --- |
| `get_kitchen_session` | Whether this browser is signed in, and to which kitchen |
| `sign_in_to_kitchen` / `sign_out_of_kitchen` | Sign in with a kitchen password, or sign out |
| `list_recipes`, `get_recipe` | Read the shared recipe library, filtered by meal type or name |
| `add_recipe`, `update_recipe` | Add a recipe (duplicate names are refused) or change one |
| `get_meal_plan` | The week containing a date: meals per day, macro totals and daily targets |
| `add_meal_to_plan`, `remove_meal_from_plan` | Plan or unplan a recipe for a date and meal (warns when a recipe goes over its weekly limit) |
| `update_daily_targets` | Change the kitchen's daily calorie and macro targets |

Dates are `YYYY-MM-DD`. Agents never deal with week starts or day numbers. Deleting recipes and the paid AI suggestion endpoints are deliberately not exposed: recipes are shared by every kitchen, and the agent is already an AI.

WebMCP is still a draft. Browsers without `navigator.modelContext` skip registration, so nothing changes for normal visitors. To try it, use a browser or extension that provides `navigator.modelContext` (for example Chrome's WebMCP preview flag or the MCP-B extension).

## Tests

The end-to-end tests are Playwright tests in `tests/`. They log in as a real family, so set the credentials in your shell first:

```bash
TEST_FAMILY_PASSWORD=... TEST_FAMILY_NAME="..." npx playwright test
```

See [README-TESTING.md](README-TESTING.md) for details.

## License

MIT
