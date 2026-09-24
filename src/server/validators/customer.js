import { z } from "zod";
import { paise, pagination } from "./common.js";
import { normalizePhone } from "../../lib/phone.js";
import { MIN_PASSWORD_LENGTH } from "../auth/password.js";

// NOTE: no .default() on these base fields. In zod 4 a default still fills in a
// MISSING key even when the field is later made .optional() — so a PATCH that
// only sends shopName would blank out every other field. Defaults are added
// only in the create schema below.
const optionalText = (max, label) => z.string().trim().max(max, `${label} is too long.`);

export const phoneField = z.string({ error: "Enter a mobile number." }).transform((value, ctx) => {
  const phone = normalizePhone(value);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number." });
    return z.NEVER;
  }
  return phone;
});

export const passwordField = z
  .string({ error: "Enter a password." })
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(100, "Password is too long.");

const addressSchema = z
  .object({
    line1: optionalText(200, "Address"),
    line2: optionalText(200, "Address"),
    landmark: optionalText(120, "Landmark"),
    city: optionalText(80, "City"),
    state: optionalText(80, "State"),
    pincode: z.union([z.literal(""), z.string().trim().regex(/^\d{6}$/, "PIN code must be 6 digits.")]),
  })
  .partial(); // an address is replaced as a whole; missing parts are stored empty

const fields = {
  shopName: z.string({ error: "Enter the shop name." }).trim().min(2, "Enter the shop name.").max(120, "Shop name is too long."),
  ownerName: optionalText(100, "Owner name"),
  phone: phoneField,
  email: z.union([z.literal(""), z.email("Enter a valid email.").toLowerCase()]),
  gstin: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN."),
    ]),
  // Optional on create — generated automatically (C0001, C0002 …) when empty.
  customerCode: z
    .union([z.literal(""), z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,30}$/, "Use letters, numbers and - only.")]),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  creditLimit: paise("credit limit"),
  paymentTerms: optionalText(60, "Payment terms"),
  notes: optionalText(1000, "Notes"),
};

const CREATE_DEFAULTS = {
  ownerName: "", email: "", gstin: "", customerCode: "", billingAddress: {}, shippingAddress: {},
  creditLimit: 0, paymentTerms: "", notes: "",
};

export const customerCreateSchema = z.object({
  ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, k in CREATE_DEFAULTS ? v.default(CREATE_DEFAULTS[k]) : v])),
  password: passwordField,
});

// PATCH: every field optional, nothing defaulted → omitted fields stay unchanged.
export const customerUpdateSchema = z.object(fields).partial().strict();

export const customerStatusSchema = z.object({ isActive: z.boolean({ error: "isActive must be true or false." }) });

export const customerPasswordSchema = z.object({ password: passwordField });

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["all", "active", "inactive"]).catch("all"),
  ...pagination,
});

// ---- The shop editing its own details ----

export const shopProfileSchema = z
  .object({
    ownerName: optionalText(100, "Name"),
    email: z.union([z.literal(""), z.email("Enter a valid email.").toLowerCase()]),
  })
  .partial()
  .strict();

const requiredText = (max, message) => z.string({ error: message }).trim().min(1, message).max(max, "That's too long.");

const shopAddressFields = {
  label: optionalText(40, "Label"),
  line1: requiredText(200, "Enter the shop/building and street."),
  line2: optionalText(200, "Address"),
  landmark: optionalText(120, "Landmark"),
  city: requiredText(80, "Enter the city or town."),
  state: optionalText(80, "State"),
  pincode: z.string({ error: "Enter the PIN code." }).trim().regex(/^\d{6}$/, "PIN code must be 6 digits."),
  isDefault: z.boolean(),
};

export const shopAddressCreateSchema = z
  .object({ ...shopAddressFields, label: shopAddressFields.label.default("Shop"), line2: shopAddressFields.line2.default(""), landmark: shopAddressFields.landmark.default(""), state: shopAddressFields.state.default(""), isDefault: shopAddressFields.isDefault.default(false) })
  .strict();

export const shopAddressUpdateSchema = z.object(shopAddressFields).partial().strict();
