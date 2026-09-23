import { z } from "zod";

export const objectId = (label = "record") =>
  z.string({ error: `Select a ${label}.` }).regex(/^[a-f\d]{24}$/i, `Select a valid ${label}.`);

// Money is sent to the API as integer PAISE (₹650.50 → 65050).
export const paise = (label = "amount") =>
  z
    .number({ error: `Enter a valid ${label}.` })
    .int(`Enter a valid ${label}.`)
    .min(0, `${label[0].toUpperCase() + label.slice(1)} cannot be negative.`)
    .max(10_000_000_00, `${label[0].toUpperCase() + label.slice(1)} is too large.`);

export const httpsUrl = z
  .union([z.literal(""), z.url({ protocol: /^https$/, error: "Enter a full https:// link." })])
  .default("");

export const pagination = {
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(25),
};

// Turns URLSearchParams into a plain object for zod (first value wins).
export function paramsToObject(searchParams) {
  const out = {};
  for (const [key, value] of searchParams) if (!(key in out)) out[key] = value;
  return out;
}
