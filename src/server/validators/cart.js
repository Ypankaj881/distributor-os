import { z } from "zod";

export const cartQuantitySchema = z.object({
  quantity: z
    .number({ error: "Enter a quantity." })
    .int("Quantity must be a whole number.")
    .min(0, "Quantity can't be negative.")
    .max(100_000, "Quantity is too large."),
});
