import { notFound } from "next/navigation";
import { getCustomer } from "@/server/services/customerService";
import { AppError } from "@/server/http/errors";

// Shared by the customer pages: shows the 404 page for missing customers and
// for customers of another company (the service answers 404 for both).
export async function loadCustomerOr404(companyId, id) {
  try {
    return await getCustomer(companyId, id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
}
