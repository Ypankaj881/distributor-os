import { z } from "zod";
import { objectId, paise, pagination } from "./common.js";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

export const setPricesSchema = z.object({
  // Applied to every price in this request. Omitted/empty = starts right now.
  effectiveFrom: z.union([z.literal(""), dateOnly]).optional(),
  // Last day the price applies (inclusive). Omitted/empty = no end date.
  effectiveTo: z.union([z.literal(""), dateOnly]).nullable().optional(),
  prices: z
    .array(
      z.object({
        productId: objectId("product"),
        price: paise("price").min(1, "Price must be more than ₹0."),
      }),
    )
    .min(1, "No price changes to save.")
    .max(200, "Save at most 200 prices at a time."),
});

export const priceListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  brandId: objectId().optional().catch(undefined),
  view: z.enum(["all", "special"]).catch("all"),
  ...pagination,
});
