import { z } from "zod";
import { GST_RATES } from "../../lib/constants.js";
import { objectId, paise, pagination } from "./common.js";

const text = (label, max) => z.string({ error: `Enter ${label}.` }).trim().max(max, `${label} is too long.`);

const qty = (label, min) =>
  z.number({ error: `Enter a valid ${label}.` }).int(`${label} must be a whole number.`).min(min, `${label} must be at least ${min}.`).max(1_000_000);

const fields = {
  brandId: objectId("brand"),
  name: text("a product name", 150).min(2, "Enter a product name."),
  sku: text("a SKU / product code", 40)
    .min(1, "Enter a SKU / product code.")
    .regex(/^[A-Za-z0-9._\-/]+$/, "Use only letters, numbers and - _ . /")
    .transform((s) => s.toUpperCase()),
  description: text("a description", 2000),
  imageUrl: z.union([z.literal(""), z.url({ protocol: /^https$/, error: "Enter a full https:// image link." })]),
  unit: text("a unit", 20).min(1, "Enter a unit (e.g. box, piece).").transform((s) => s.toLowerCase()),
  packSize: qty("pack size", 1).nullable(),
  mrp: paise("MRP"),
  defaultPrice: paise("selling price").min(1, "Selling price must be more than ₹0."),
  gstRate: z.number({ error: "Select a GST rate." }).refine((v) => GST_RATES.includes(v), "Select a valid GST rate."),
  hsnCode: z.union([z.literal(""), z.string().trim().regex(/^\d{4,8}$/, "HSN code must be 4–8 digits.")]),
  minOrderQty: qty("minimum order quantity", 1),
  isActive: z.boolean(),
};

export const productCreateSchema = z.object({
  ...fields,
  description: fields.description.default(""),
  imageUrl: fields.imageUrl.default(""),
  unit: fields.unit.default("piece"),
  packSize: fields.packSize.default(null),
  mrp: fields.mrp.default(0),
  gstRate: fields.gstRate.default(18),
  hsnCode: fields.hsnCode.default(""),
  minOrderQty: fields.minOrderQty.default(1),
  isActive: fields.isActive.default(true),
  // Opening stock. After creation, stock only changes via the stock endpoint.
  stockQuantity: qty("opening stock", 0).default(0),
});

// PATCH: all optional; stockQuantity deliberately NOT editable here.
export const productUpdateSchema = z.object(fields).partial().strict();

export const stockAdjustSchema = z.object({
  change: z
    .number({ error: "Enter a quantity." })
    .int("Quantity must be a whole number.")
    .refine((v) => v !== 0, "Quantity cannot be zero.")
    .refine((v) => Math.abs(v) <= 1_000_000, "Quantity is too large."),
});

export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  brandId: objectId().optional().catch(undefined),
  status: z.enum(["all", "active", "inactive"]).catch("all"),
  stock: z.enum(["low", "out"]).optional().catch(undefined),
  ...pagination,
});
