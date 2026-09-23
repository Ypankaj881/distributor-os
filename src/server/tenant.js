import { config } from "./config.js";

// Decides WHICH distributor (company) a login request belongs to.
// V1: a single distributor, configured by DEFAULT_COMPANY_SLUG.
// Later: read the subdomain from the request (chandrika.yourapp.in → "chandrika").
// Only this function changes when that happens.
export function resolveCompanySlug(_req) {
  return config.defaultCompanySlug();
}
