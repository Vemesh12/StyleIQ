# StyleIQ — Men's Fashion Knowledge Platform

A men's outfit-compatibility and style-recommendation platform built with Next.js
(App Router), Prisma, and PostgreSQL.

- **Scoring engine** — one scorer for every feature: color harmony (painter's
  color wheel, curated pairs), garment compatibility, fabric mixing, formality,
  occasion, season/weather, skin undertone and body shape. Every score explains
  each dimension.
- **Outfit Builder, Style Advisor, Quick Pick** — score an outfit, build around
  a piece you own, or get a ready outfit for an occasion.
- **Digital wardrobe** — your closet (catalog items plus *your own items*),
  a weather-aware daily suggestion that rotates and learns from 👍/👎,
  **Complete my outfit** (lock pieces, fill the rest), **What should I buy
  next?** (items that unlock the most new outfits), and a wear **history**.
- **Accounts** — the Style Advisor profile, wardrobe, saved outfits, history
  and ratings follow the account across devices.
- **Admin panel** — garments, garment-pair and color-pair rules, guides, style
  rules, and bulk CSV import with validation.

## Prerequisites

- Node.js 20+
- A PostgreSQL database (local or hosted)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in the values:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — PostgreSQL connection string. **Required.**
   - `JWT_SECRET` — secret used to sign session tokens. **Required**; the app
     refuses to start without it. Generate one with `openssl rand -base64 32`.
   - `NEXT_APP_URL` — public base URL (defaults to `http://localhost:3000`).
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the admin account the seed creates. If
     `ADMIN_PASSWORD` is empty, a random password is generated and printed once.
   - `TRUSTED_PROXY_HOPS` — number of reverse proxies in front of the app, used to
     read the real client IP for rate limiting (default `1`).
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — optional; share rate
     limits across server instances (otherwise kept in memory per process).

   The server validates these at startup (`src/lib/env.ts`). If something is
   missing or malformed it logs one message listing every problem and answers
   every request with an error until the configuration is fixed.

3. Create the tables and load the catalog:

   ```bash
   npm run db:setup
   ```

   This applies every migration in `prisma/migrations` and then runs the seed,
   which loads everything from `prisma/data/`:

   - `catalog.json` — garment types, ~210 colors, fits/materials/patterns,
     occasions/seasons, ~180 garments with all their attributes, curated garment
     and color pairing rules, style guides and style rules.
   - `personalization.json` — skin-undertone, body-shape and torso-length advice,
     expanded into the `personalization_rules` table.

   The seed is idempotent: re-running it re-syncs the catalog to the files
   without duplicating anything or touching users, wardrobes or saved outfits.

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The admin panel is at
   `/admin` (log in with the account from step 3).

## Working with the database

- **Change the schema:** edit `prisma/schema.prisma`, then run
  `npx prisma migrate dev --name <what-changed>` and commit the new folder in
  `prisma/migrations`. Never edit a migration that has already been applied.
- **Save catalog edits made in the admin panel:** run `npm run db:export` to
  rewrite `prisma/data/*.json` from your database, review the diff, and commit
  it so everyone else gets the same catalog.
- **Change an admin password:**

  ```bash
  ADMIN_EMAIL=admin@styleiq.com ADMIN_PASSWORD='a-long-new-password' npm run admin:set-password
  ```

- **Upgrading a database created before migrations existed** (it was built with
  `prisma db push` and has no `_prisma_migrations` table): mark the baseline as
  already applied, then deploy the rest.

  ```bash
  npx prisma migrate resolve --applied 0_init
  npm run db:migrate
  ```

The database also enforces value ranges and allowed values (scores, ratings,
formality 1–5, rule and guide categories) with CHECK constraints, so a bad
write fails loudly instead of corrupting scoring.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build / run it
- `npm run lint` / `npm run typecheck` — ESLint / TypeScript
- `npm test` — unit tests (Vitest; no database needed). `npm run test:watch` while developing
- `npm run test:e2e` — end-to-end tests against a running app (`npm run dev`) and its database
- `npm run db:setup` — apply migrations and seed (fresh database)
- `npm run db:migrate` — apply pending migrations
- `npm run db:seed` — re-sync the catalog from `prisma/data`
- `npm run db:export` — write the current catalog back to `prisma/data`
- `npm run admin:set-password` — create an admin or change its password

## Project structure

- `src/app/` — App Router pages and API routes (`src/app/api/**`)
- `src/lib/rule-engine/` — the scoring engine: `core.ts` (one scorer for every
  flow), `config.ts` (all weights and thresholds), `color-rules.ts`,
  `personalization.ts`, `catalog.ts` (data loading/caching)
- `src/lib/auth.ts`, `src/lib/session-token.ts` — admin/user sessions (JWT)
- `src/lib/validation.ts` — zod request-validation schemas for API routes
- `prisma/schema.prisma` — data model; `prisma/migrations/` — its history
- `prisma/data/` — catalog and personalization data loaded by `prisma/seed.ts`
- `prisma/export-catalog.ts` — writes `prisma/data/` from a database

## Tests and CI

- Unit tests live next to the code in `__tests__` folders (`*.test.ts(x)`) and
  cover the scoring engine (colors, compatibility, personalization, item
  picker, quick pick), the security helpers (session tokens, rate limiting,
  JSON-LD escaping), the color scanner, Markdown rendering and validation.
  The engine tests use a small hand-built catalog
  (`src/lib/rule-engine/__tests__/fixtures.ts`), so they run without Postgres.
- End-to-end tests (`tests/e2e`) make real HTTP requests to a running app:
  account profile sync, private user items (and that they never leak into the
  public catalog), complete-my-outfit, feedback/wear-history re-ranking,
  wardrobe gaps, CSRF protection, admin color rules and bulk import. They
  create their own test data and delete it afterwards.
- GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull
  request: lint, typecheck and unit tests; then, against a throwaway
  Postgres, `db:setup` (migrations + seed), a schema-drift check,
  `next build`, and the end-to-end suite against the production build.
- Set `PRISMA_LOG_QUERIES=1` to log every SQL query while debugging.

## Security notes

- Admin and user sessions are separate signed tokens (role-bound), re-checked
  against the database on every request.
- State-changing API requests from another site's origin are rejected (CSRF),
  on top of `SameSite=Lax` session cookies.
- Login, registration and the expensive recommendation endpoints are rate
  limited (Redis-backed when Upstash is configured).
- Users' own items are private: excluded from the catalog, encyclopedia,
  sitemap, admin lists and `db:export`.

## Deploying

1. Set the environment variables from step 2 on the host. In production
   `JWT_SECRET` must be 32+ characters and `ADMIN_PASSWORD` 12+ characters.
   `NEXT_APP_URL` should be the real `https://` URL; set it before
   `npm run build`, because `robots.txt` is generated at build time. Serve over HTTPS —
   session cookies are `Secure` in production.
2. `npm ci`, then `npm run db:migrate` (`npm run db:setup` on an empty
   database). The seed uses `tsx`, which is a production dependency.
3. `npm run build` — the build pre-renders catalog pages, so it **needs a
   reachable database**. Then `npm start`.
4. Sign in to `/admin` and change the admin password if the seed generated one.

Things to know:

- **Re-running the seed overwrites the catalog** with `prisma/data/`. Run
  `npm run db:export` and commit first if admins edited the catalog in production.
- **More than one server instance:** set the Upstash variables so rate limits
  are shared. Catalog caches are per process and refresh within a few minutes
  of an admin edit on other instances.
- **Serverless / many connections:** use a pooled `DATABASE_URL` (e.g. PgBouncer,
  Neon/Supabase pooler with `?pgbouncer=true&connection_limit=1`).
- Set `TRUSTED_PROXY_HOPS` to the number of proxies in front of the app, or
  rate limiting will key on the proxy's IP.

## Notes

- Personalization advice depends on one input each: clothing colors and metals
  on skin **undertone**, fit/pattern/fabric advice on **body proportion**, shoe
  advice on **torso length**. Hair, eye color and skin tone are stored but do
  not change the advice in the current dataset.
