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
| `npm run admin:create` | Create the company + an admin, or reset an admin's password |
| `npm run dev:retailer` | DEV ONLY: create a demo shop + retailer login |

## Creating or resetting the admin

PowerShell (the password is set for this terminal only, never saved to a file):

```powershell
$env:COMPANY_NAME="Chandrika Enterprises"   # only needed the first time
$env:ADMIN_EMAIL="owner@example.com"
$env:ADMIN_NAME="Owner Name"
$env:ADMIN_PASSWORD="choose-a-strong-password"
npm run admin:create
```

Running it again with the same `ADMIN_EMAIL` **resets** the password and logs that admin out everywhere.

## How authentication works

- Passwords are hashed with bcrypt (cost 12). Plain passwords are never stored or logged.
- Login sets a signed JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production), valid 7 days.
- Every page and API request re-loads the user from MongoDB, so deactivating a user or
  resetting a password (`tokenVersion` + 1) ends their sessions immediately.
- `src/proxy.js` redirects logged-out users early and blocks cross-site write requests;
  the real checks are `requireAdmin()` / `requireRetailer()` (API) and
  `requireAdminPage()` / `requireRetailerPage()` (pages) in `src/server/auth/guards.js`.
- Failed logins are rate-limited: 5 per account and 30 per IP per 15 minutes (stored in MongoDB).

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
