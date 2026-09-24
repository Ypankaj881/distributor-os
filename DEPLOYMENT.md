# Deployment guide — Vercel + MongoDB Atlas

Target: **https://order.chandrika-enterprises.in** (the public site stays where it is).
Time needed: about 45 minutes the first time. Nothing here costs money on the free tiers.

```
Shop's phone / admin's PC
        │  HTTPS
        ▼
Vercel (Next.js app, Mumbai region "bom1")  ──►  MongoDB Atlas (database "distributor_os_prod")
```

---

## 1. Put the code on GitHub (5 min)

Vercel deploys from a Git repository.

1. Create a **private** repository on github.com, e.g. `distributor-os` (no README/licence — the project has them).
2. In the project folder:
   ```bash
   git remote add origin https://github.com/<you>/distributor-os.git
   git push -u origin main
   ```
3. Check on GitHub that **`.env.local` is NOT in the repository** (it's git-ignored). Only `.env.example` and `.env.test` (no secrets) should be there.

## 2. Prepare the production database (10 min)

Use a **separate database and a separate database user** for production, so a mistake in
development can never touch real orders.

1. **Atlas → Database Access → Add New Database User**
   - Username: `distributor_prod`
   - Password: click **Autogenerate** (letters/numbers only avoids URL-encoding issues) and copy it somewhere safe.
   - **Built-in role → Specific privileges → `readWrite` on database `distributor_os_prod`** only.
2. **Atlas → Network Access → Add IP Address → Allow access from anywhere (`0.0.0.0/0`)**.
   Vercel's servers don't have fixed IP addresses, so Atlas can't allow-list them one by one.
   Access is still protected by the database user's password and TLS. (Later, on a paid Atlas tier,
   you can use Vercel's static IPs / private networking instead.)
3. **Check the cluster region**: Atlas → your cluster → region. If it's **Mumbai (ap-south-1)**, keep
   `vercel.json` as is (`bom1` = Mumbai). If it's elsewhere, change `regions` in `vercel.json` to the
   nearest Vercel region (e.g. `sin1` Singapore, `iad1` US East) — app and database should be close.
4. On your PC, create **`.env.production.local`** (git-ignored) with the production values:
   ```ini
   MONGODB_URI=mongodb+srv://distributor_prod:<password>@cluster0.bdqqhky.mongodb.net/?appName=Cluster0
   MONGODB_DB=distributor_os_prod
   AUTH_SECRET=<generate a NEW one — never reuse the development secret>
   APP_URL=https://order.chandrika-enterprises.in
   DEFAULT_COMPANY_SLUG=chandrika
   ```
   Generate the secret with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
5. Check the connection and create the indexes (unique indexes enforce important rules):
   ```bash
   npm run db:check:prod
   npm run db:indexes:prod
   ```
6. Create the company and Chandrika's real admin (PowerShell):
   ```powershell
   $env:COMPANY_NAME="Chandrika Enterprises"; $env:ADMIN_EMAIL="<real email>"; $env:ADMIN_NAME="<name>"; $env:ADMIN_PASSWORD="<strong password>"; npm run admin:create:prod
   ```
   **Never run `seed:demo`, `dev:retailer` or `npm test` against production.** (Tests only run on
   databases ending in `_test`, and the seed refuses `NODE_ENV=production`, but keep production clean.)

## 3. Deploy on Vercel (10 min)

1. Sign in at **vercel.com** with GitHub → **Add New… → Project** → import `distributor-os`.
2. Framework preset: **Next.js** (auto-detected). Leave build settings as they are.
3. **Environment Variables** — add each line from `.env.production.local` (name + value),
   for the **Production** environment.
4. Click **Deploy**. When it finishes you get a URL like `distributor-os-xyz.vercel.app`.
5. Check it:
   - `https://<vercel-url>/api/health` → `{"success":true,"data":{"status":"ok","db":"connected"}}`
   - `https://<vercel-url>/admin/login` → log in with the admin from step 2.6.

If health says `DB_UNAVAILABLE`: re-check the Network Access entry (step 2.2), the password in
`MONGODB_URI`, and that the variables were saved for **Production** — then **Redeploy**.

## 4. Custom domain: order.chandrika-enterprises.in (10 min + DNS wait)

1. Vercel → Project → **Settings → Domains → Add** `order.chandrika-enterprises.in`.
2. Vercel shows a DNS record to create, normally:
   | Type | Name | Value |
   |---|---|---|
   | CNAME | `order` | `cname.vercel-dns.com` (use exactly what Vercel shows) |
3. Add it where the domain's DNS is managed (the registrar or host of chandrika-enterprises.in).
   Don't change the existing records for the main site.
4. Wait until Vercel shows **Valid Configuration** (minutes to a few hours). HTTPS is set up automatically.
5. If you changed `APP_URL`, it must match the final domain — update it in Vercel and redeploy.

## 5. Link from the public website

Add a button/link to chandrika-enterprises.in (header or contact section):

```html
<a href="https://order.chandrika-enterprises.in/login"
   style="display:inline-block;padding:10px 18px;border-radius:8px;background:#2553e0;color:#fff;text-decoration:none;font-weight:600">
  Retailer Login
</a>
```

(The admin uses `https://order.chandrika-enterprises.in/admin/login` — no need to link it publicly.)

## 6. First-day setup in the app

1. **Admin → Settings**: order prefix `CH`, WhatsApp/phone number, GSTIN, address, GST mode
   (confirm with Chandrika whether prices are quoted before or including GST).
2. **Brands → Products**: real catalogue, real prices, opening stock.
3. **Customers**: add the pilot shops (start with 3–5), set special prices, share login details.
4. Place one test order yourself as a shop, confirm it as admin, then cancel it with reason
   "Test order" (stock is returned).

## 7. Operations

| Task | How |
|---|---|
| Deploy a change | `git push` to `main` → Vercel builds and deploys automatically (a failed build keeps the old version live) |
| Roll back | Vercel → Deployments → pick the previous one → **Promote to Production** |
| Logs / errors | Vercel → Project → **Logs** (server errors are logged with details there, never shown to users) |
| Uptime alert | Free monitor (e.g. UptimeRobot) on `https://order.chandrika-enterprises.in/api/health` every 5 min |
| **Backups** | The free Atlas tier has **no automatic backups**. Run `npm run db:backup:prod` regularly (e.g. daily) and store the `backups/` folder safely — it contains customer data. Move to a paid tier with snapshots once the pilot is live. |
| Reset an admin password | `npm run admin:create:prod` with the same `ADMIN_EMAIL` and a new password |
| Reset a shop password | Admin → Customers → shop → **Set new password** |
| After changing indexes in a model | `npm run db:indexes:prod` |

---

## Go-live checklist

- [ ] Code on GitHub (private); `.env.local` / `.env.production.local` NOT committed
- [ ] Production DB user with `readWrite` on `distributor_os_prod` only
- [ ] New `AUTH_SECRET` for production (different from development)
- [ ] `npm run db:indexes:prod` done
- [ ] Real admin created with a strong password; demo admin NOT created in production
- [ ] Vercel env vars set for Production; `/api/health` = ok on the live domain
- [ ] `vercel.json` region matches the Atlas region
- [ ] Domain shows **Valid Configuration**; site loads on `https://` (padlock)
- [ ] Settings filled in: prefix `CH`, phone, GST mode
- [ ] Real products, prices and 3–5 pilot shops entered; logins shared
- [ ] One end-to-end test order placed → confirmed → cancelled
- [ ] Tested on an actual shopkeeper's phone (Android + mobile data)
- [ ] "Retailer Login" link added to chandrika-enterprises.in
- [ ] Uptime monitor on `/api/health`
- [ ] First backup taken with `npm run db:backup:prod`
