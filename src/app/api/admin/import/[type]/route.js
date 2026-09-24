import { z } from "zod";
import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { Errors } from "@/server/http/errors";
import { importProducts, importCustomers, importPrices } from "@/server/services/importService";

// Large imports (up to 2000 rows) need more than the default time.
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string({ error: "Choose a file or paste your rows." }).min(1, "Choose a file or paste your rows."),
  dryRun: z.boolean().default(true),
});

// POST /api/admin/import/products | customers | prices — { text: "<csv or pasted cells>", dryRun }
// dryRun: true  → check every row and report, save nothing
// dryRun: false → save the valid rows (same rules as the normal screens)
export const POST = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { type } = await params;
  const { text, dryRun } = bodySchema.parse(await readJson(req));
  const opts = { dryRun, userId: auth.userId, timeZone: auth.company.settings?.timezone ?? "Asia/Kolkata" };
  if (type === "products") return ok(await importProducts(auth.companyId, text, opts));
  if (type === "customers") return ok(await importCustomers(auth.companyId, text, opts));
  if (type === "prices") return ok(await importPrices(auth.companyId, text, opts));
  throw Errors.notFound("Import type");
});
