import { z } from "zod";
import { objectId } from "./common.js";

// Retailer product browsing. Smaller pages than admin: phones on mobile data.
export const shopProductQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  brandId: objectId().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).catch(1),
  limit: z.coerce.number().int().min(1).max(48).catch(20),
});
