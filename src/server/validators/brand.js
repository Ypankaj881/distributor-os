import { z } from "zod";
import { httpsUrl } from "./common.js";

const fields = {
  name: z.string({ error: "Enter a brand name." }).trim().min(1, "Enter a brand name.").max(80, "Name is too long."),
  logoUrl: httpsUrl,
  sortOrder: z.number({ error: "Enter a number." }).int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
};

export const brandCreateSchema = z.object(fields);

// PATCH: every field optional, and no defaults (so omitted fields stay unchanged).
export const brandUpdateSchema = z
  .object({
    name: fields.name.optional(),
    logoUrl: z.union([z.literal(""), z.url({ protocol: /^https$/, error: "Enter a full https:// link." })]).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
