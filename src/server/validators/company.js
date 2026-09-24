import { z } from "zod";
import { normalizePhone } from "../../lib/phone.js";

const text = (max) => z.string().trim().max(max);

// PATCH /api/admin/settings — every field optional; no defaults, so omitted
// fields stay unchanged. Timezone and slug are not editable in V1.
export const companySettingsSchema = z
  .object({
    name: text(120).min(2, "Enter the business name."),
    // Optional: empty clears it; otherwise must be a valid Indian mobile.
    phone: z.string().transform((v, ctx) => {
      if (!v.trim()) return "";
      const p = normalizePhone(v);
      if (!p) {
        ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number." });
        return z.NEVER;
      }
      return p;
    }),
    email: z.union([z.literal(""), z.email("Enter a valid email.").toLowerCase()]),
    gstin: z.union([
      z.literal(""),
      z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN."),
    ]),
    address: z
      .object({
        line1: text(200), line2: text(200), landmark: text(120), city: text(80), state: text(80),
        pincode: z.union([z.literal(""), z.string().trim().regex(/^\d{6}$/, "PIN code must be 6 digits.")]),
      })
      .partial()
      .strict(),
    settings: z
      .object({
        orderPrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, "1–6 letters or numbers, e.g. CH."),
        pricesIncludeGst: z.boolean(),
        allowNegativeStock: z.boolean(),
        lowStockThreshold: z
          .number({ error: "Enter a number." })
          .int("Whole numbers only.")
          .min(0, "Can't be negative.")
          .max(100_000, "That's too high."),
        defaultCreditDays: z.number({ error: "Enter a number of days." }).int("Whole days only.").min(0, "Can't be negative.").max(365, "At most 365 days."),
      })
      .partial()
      .strict(),
  })
  .partial()
  .strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: "Enter your current password." }).min(1, "Enter your current password."),
  newPassword: z.string({ error: "Enter a new password." }).min(8, "New password must be at least 8 characters.").max(100),
});
