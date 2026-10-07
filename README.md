# StyleIQ — Men's Fashion Knowledge Platform

A men's outfit-compatibility and style-recommendation platform built with Next.js
(App Router), Prisma, and PostgreSQL. It includes a color-harmony/garment
compatibility rule engine, an outfit builder that scores looks out of 100, a
personalization engine driven by a hair/eye/skin-tone dataset, a digital
wardrobe, and an admin panel for managing garments and compatibility rules.

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

   Required variables:
   - `DATABASE_URL` — PostgreSQL connection string.
   - `JWT_SECRET` — secret used to sign session tokens. The app will refuse to
     start without this set. Generate one with `openssl rand -base64 32`.
   - `NEXT_PUBLIC_APP_URL` — public base URL (defaults to `http://localhost:3000`).

3. Apply the Prisma schema to your database:

   ```bash
   npx prisma migrate dev
   ```

4. Seed the database. Run these **in order** — each builds on the last:

   ```bash
   npx prisma db seed      # base catalog: garment types, ~30 colors, admin user, compatibility rules
   npm run seed:colors     # adds the expanded ~245-color palette
   npm run seed:catalog    # adds new garment types (T-Shirt, Polo, Sweater, ...) + real
                           # fit/material/pattern/occasion/season data across the whole catalog
   npm run seed:rules      # expands curated CompatibilityRule / ColorCompatibilityRule coverage
   npx tsx prisma/seed-csv.ts   # personalization dataset (hair/eye/skin-tone recommendations)
   ```

   (`npm run seed:all` runs the first four in sequence.) All five scripts are
   idempotent (upsert/skip-duplicates keyed by slug), so re-running any of
   them is safe.

   `prisma/seed-csv.ts` reads `recommendations.csv` from the repo root (one
   level above this `styleiq/` folder) by default. Set
   `RECOMMENDATIONS_CSV_PATH` in `.env` to point elsewhere if needed.

   The default seeded admin login is `admin@styleiq.com` / `admin123` — this
   is a local-dev convenience only. **Change this password (or the seeded
   email) before deploying anywhere reachable by others** — the seed script
   does not warn or prompt about this.

5. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — run ESLint

## Project structure

- `src/app/` — App Router pages and API routes (`src/app/api/**`)
- `src/lib/rule-engine/` — color-harmony and garment-compatibility scoring logic
- `src/lib/auth.ts` — admin/user session (JWT) helpers
- `src/lib/validation.ts` — zod request-validation schemas for API routes
- `prisma/schema.prisma` — data model
- `prisma/seed.ts` / `prisma/seed-colors.ts` / `prisma/seed-catalog-v2.ts` / `prisma/seed-rules-expansion.ts` / `prisma/seed-csv.ts` — database seed scripts (see setup steps above for run order)

## Notes

- There is currently no automated test suite for this project.
- All application code lives under `styleiq/`, which is its own git repository.
