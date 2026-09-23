import { notFound } from "next/navigation";
import { getShopOrder } from "@/server/services/orderService";
import { AppError } from "@/server/http/errors";

// 404 page for missing orders and for other shops' orders.
export async function loadShopOrderOr404(auth, orderId) {
  try {
    return await getShopOrder(auth.companyId, auth.customerId, orderId);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
}
