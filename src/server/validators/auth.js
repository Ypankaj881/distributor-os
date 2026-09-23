import { z } from "zod";

export const loginSchema = z.object({
  portal: z.enum(["admin", "shop"], { error: "Invalid login portal." }),
  identifier: z
    .string({ error: "Enter your mobile number or email." })
    .trim()
    .min(1, "Enter your mobile number or email.")
    .max(254),
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password.").max(200),
});
