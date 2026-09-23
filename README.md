# Distributor OS — B2B Ordering Portal

Private B2B ordering and order management for distributors and their retail shops.
First customer: Chandrika Enterprises. Every business record is scoped by `companyId`,
so more distributors can be onboarded later without data mixing.

**Stack:** Next.js 16 (App Router, JavaScript) · Tailwind CSS 4 · MongoDB Atlas + Mongoose · bcryptjs · jose · zod

## Setup

1. Install Node.js 20+ (22 recommended).
2. `npm install`
3. `cp .env.example .env.local` and fill in values (see comments in the file).
4. In MongoDB Atlas → **Network Access**, allow your IP address.
5. `npm run db:check` → should print `✔ Connected to MongoDB`.
6. `npm run dev` → http://localhost:3000

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm start` | Production build / run |
| `npm run lint` | ESLint |
| `npm run db:check` | Test the MongoDB connection |

## Folder structure

```
src/
  app/                 Routes (pages + API route handlers)
    (shop)/            Retailer area — URL has no "(shop)" prefix, e.g. /orders
    admin/(panel)/     Admin area with sidebar — /admin, /admin/orders …
    api/               JSON API: /api/auth, /api/admin/*, /api/shop/*
  components/
    ui/                Generic building blocks (Button, Input, Card, Badge …)
    admin/  shop/      Area-specific components
  server/              Server-only code — never import from client components
    config.js          Environment variable access
    db.js              Cached Mongoose connection
    http/              Error types, response helpers, withApi() wrapper
    models/            Mongoose schemas            (Phase 2+)
    services/          Business logic              (Phase 2+)
    validators/        zod request schemas         (Phase 2+)
    auth/              Sessions, passwords, guards (Phase 2)
  lib/                 Shared by server and UI (constants, money helpers)
scripts/               CLI scripts (db check, seed, create admin)
```

## Conventions

- **Money is integer paise.** `₹650.50` is stored as `65050`. Use `src/lib/money.js` to convert/format.
- **API response shape:** `{ success: true, data, meta? }` or `{ success: false, error: { code, message, fields? } }`.
- **Route handlers stay thin:** authenticate → validate (zod) → call a service → respond. Wrap them in `withApi()`.
- **Every business query includes `companyId` from the session**, never from the request body.
- **Inside `src/server/`, use relative imports with `.js` extensions** (e.g. `./db.js`) so the same files work in Next.js *and* in plain-Node scripts like the seed script. Pages/components can use the `@/` alias.
