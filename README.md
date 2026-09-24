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
| `npm run seed:demo` | DEV ONLY: reset demo data (brands, 24 products, 5 shops, prices, 9 orders) |
| `npm run seed:demo -- --remove` | Remove all demo data (real data is untouched) |
| `npm test` / `npm run test:unit` | Full test suite / fast unit tests |
| `npm run search:rebuild` | Rebuild product/customer search text (after imports or manual DB edits) |

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

## Demo data

```powershell
$env:SEED_DEMO_PASSWORD="choose-a-demo-password"   # password for all 5 demo shop logins
npm run seed:demo
```

Creates, through the real services: brands Bellavita, Natraj, Apsara, Fastrack; 24 placeholder
products (SKU `DEMO-…`, round placeholder prices — **not real prices**; some low / out of stock,
one inactive, some with minimum quantities); 5 shops `[DEMO] …` with logins `9000000001`–`9000000005`;
special prices for 4 shops plus one scheduled future price; 9 orders over the last 12 days in every
status (delivered, cancelled, dispatched, packed, partially confirmed, new) with payment states.

Running it again **resets** the demo data. `npm run seed:demo -- --remove` deletes only records
marked as demo (`DEMO-` codes/SKUs) and seeded brands left without products. It refuses to run
with `NODE_ENV=production`. It needs an admin to exist (`npm run admin:create`).

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

## Admin API (role ADMIN; everything scoped to the admin's company)

| Method & path | Purpose |
|---|---|
| `GET/POST /api/admin/brands` | List (with product counts) / create |
| `PATCH/DELETE /api/admin/brands/:id` | Update / soft delete (refused while it has products) |
| `GET/POST /api/admin/products` | List (`q`, `brandId`, `status`, `stock`, `page`, `limit`) / create |
| `GET/PATCH/DELETE /api/admin/products/:id` | Read / update / soft delete |
| `POST /api/admin/products/:id/stock` | `{ change: 50 }` or `{ change: -3 }` — atomic stock adjustment |
| `GET/POST /api/admin/customers` | List (`q`, `status`, `page`) / create shop **and** its login |
| `GET/PATCH /api/admin/customers/:id` | Read / update (changing phone changes the login ID) |
| `PATCH /api/admin/customers/:id/status` | `{ isActive }` — deactivating logs the shop out everywhere |
| `POST /api/admin/customers/:id/password` | `{ password }` — admin sets a new password |
| `GET/PUT /api/admin/customers/:id/prices` | Pricing grid (`q`, `brandId`, `view=all\|special`) / set many prices |
| `DELETE /api/admin/customers/:id/prices/:productId` | Remove special price → default applies |
| `GET /api/admin/orders` | List (`status=all\|open\|closed\|NEW…`, `q`, `customerId`, `from`, `to`, `page`) + counts per status |
| `GET /api/admin/orders/:id` | Order with timeline, allowed next statuses and (for NEW) current stock |
| `POST /api/admin/orders/:id/confirm` | `{ quantities?: [{ itemId, confirmedQty }], note? }` — NEW → CONFIRMED, deducts stock |
| `PATCH /api/admin/orders/:id/status` | `{ status, note }` — PACKED / DISPATCHED / DELIVERED / CANCELLED / REJECTED |
| `PATCH /api/admin/orders/:id/payment` | `{ paymentStatus: UNPAID\|PARTIAL\|PAID }` |

Records of another company always answer **404**, exactly like missing records.

## Order lifecycle & stock

```
NEW ──confirm──▶ CONFIRMED ──▶ PACKED ──▶ DISPATCHED ──▶ DELIVERED
 ├──▶ REJECTED       └──▶ CANCELLED ◀─────┘
 └──▶ CANCELLED (also by the shop itself while NEW)
```

- **Placing** an order does not touch stock. **Confirming** deducts the confirmed quantities
  (the admin may lower them = partial supply; `cancelledQty = ordered − confirmed`), all in one
  transaction: if any line lacks stock, nothing is deducted.
- **Cancelling** a confirmed/packed order returns the confirmed quantities to stock.
- Every change appends to the order's `timeline` (status, time, who, note). Cancel/reject need a reason.
- `src/server/services/orderWorkflow.js` is the only place that changes order status.

## Pricing rule

What a shop pays for a product (before GST) is decided in ONE place,
`resolvePrices()` in `src/server/services/pricingService.js`:

1. **Customer-specific price** — an active `CustomerPrice` for that shop and product whose
   period contains "now" (`effectiveFrom ≤ now < effectiveTo`, or no end date).
   If several overlap, the one that **started most recently** wins.
2. Otherwise the product's **default selling price**.

- Prices are never overwritten: every change is a new record, so history is kept.
  Setting a price "from today" closes the running one at that moment.
- Scheduled prices: a price can start on a future date and/or end on a date
  (inclusive, in the company's timezone). When it ends, the previous open-ended price applies again.
- Special prices can't exceed MRP. Retailers only ever receive their own resolved price.

## Testing

```bash
npm test          # full suite: unit + integration (≈30 s, needs MongoDB access)
npm run test:unit # fast, no database
```

- Uses Node's built-in test runner (`node:test`) — no extra dependencies.
- Integration tests call the real services against a **separate database**
  (`MONGODB_DB=distributor_os_test` from `.env.test`), dropped before and after each file.
  The helper refuses to run against any database whose name doesn't end in `_test`.
- Covered: pricing rule (default / special / scheduled / removed), tenant isolation across
  products, brands, customers, prices, catalog and orders; cart totals & GST, MOQ, stock,
  parallel cart writes; order snapshots, idempotent double-submit, price-changed check,
  order numbering; confirm with stock (atomic rollback, partial supply, parallel confirms),
  allowed transitions, restock on cancel, shop cancel rules; reorder; login, lockout,
  forged tokens, session revocation, password change.
- `tests/unit/route-guards.test.js` fails if any API route lacks its `requireAdmin()` /
  `requireRetailer()` / `requireAuth()` guard or `withApi()` wrapper.

## Security summary

| Area | Measure |
|---|---|
| Passwords | bcrypt (cost 12); never logged or returned |
| Sessions | signed JWT in httpOnly, SameSite=Lax, Secure (prod) cookie; user re-checked in DB every request; `tokenVersion` revokes all sessions |
| Login abuse | 5 failures / account and 30 / IP per 15 min; same error + timing for unknown user vs wrong password |
| Authorization | role guard on every API route (enforced by a test) and page; admin and shop APIs are separate |
| Tenant isolation | every query filters by the session's `companyId`; other companies' records answer 404; `strictQuery: "throw"` so a mistyped filter can't match everything |
| Prices | the browser never sends prices or totals; the server recalculates them everywhere; shops only ever receive their own resolved price |
| Input | zod validation on every request, `.strict()` on updates, 1 MB body limit, regex input escaped, ObjectIds validated |
| CSRF | SameSite cookies + cross-origin write requests blocked in `proxy.js` |
| Output | React escaping (no `dangerouslySetInnerHTML`, enforced by a test); https-only image URLs; errors never include stack traces |
| Headers | nosniff, frame DENY, referrer policy, permissions policy, HSTS in production |
| Dependencies | `npm audit --omit=dev` → 0 known vulnerabilities (at time of writing) |

## Conventions

- **Money is integer paise.** `₹650.50` is stored as `65050`. Use `src/lib/money.js` to convert/format.
- **API response shape:** `{ success: true, data, meta? }` or `{ success: false, error: { code, message, fields? } }`.
- **Route handlers stay thin:** authenticate → validate (zod) → call a service → respond. Wrap them in `withApi()`.
- **Every business query includes `companyId` from the session**, never from the request body.
- **Inside `src/server/`, use relative imports with `.js` extensions** (e.g. `./db.js`) so the same files work in Next.js *and* in plain-Node scripts like the seed script. Pages/components can use the `@/` alias.
