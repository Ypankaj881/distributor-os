// ============================================================================
// PAYMENT RULES — shared by the server and the screens.
//
//   status   UNPAID  → nothing paid yet
//            PARTIAL → something paid, balance remaining
//            PAID    → paid in full
//   derived  OVERDUE → not fully paid AND today is after the due date
//            NA      → cancelled / rejected orders (nothing to collect)
//
//   Due date ("dueOn", YYYY-MM-DD in the company timezone) is set when the
//   order is DELIVERED: delivery date + the shop's credit days
//   (shop setting, or the company default; 0 = due on delivery).
//   Orders not yet delivered have no due date, so they can't be overdue.
// ============================================================================

const CLOSED = new Set(["CANCELLED", "REJECTED"]);

export function derivePaymentStatus(amountPaid, grandTotal) {
  if (amountPaid <= 0) return "UNPAID";
  if (amountPaid >= grandTotal) return "PAID";
  return "PARTIAL";
}

// Whole days between two YYYY-MM-DD dates (b − a).
export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/**
 * Everything the UI needs to show about an order's payment.
 * @param order { status, grandTotal, amountPaid, dueOn }
 * @param today "YYYY-MM-DD" in the company timezone
 */
export function paymentState(order, today) {
  const total = order.grandTotal ?? 0;
  const paid = order.amountPaid ?? 0;
  if (CLOSED.has(order.status)) return { key: "NA", label: "No payment due", tone: "gray", paid, balance: 0, dueOn: null, overdueDays: 0 };

  const status = derivePaymentStatus(paid, total);
  const balance = Math.max(total - paid, 0);
  const overdueDays = status !== "PAID" && order.dueOn && today > order.dueOn ? daysBetween(order.dueOn, today) : 0;

  if (overdueDays > 0) return { key: "OVERDUE", label: `Overdue ${overdueDays} day${overdueDays === 1 ? "" : "s"}`, tone: "red", paid, balance, dueOn: order.dueOn, overdueDays, status };
  if (status === "PAID") return { key: "PAID", label: "Paid", tone: "green", paid, balance: 0, dueOn: order.dueOn ?? null, overdueDays: 0, status };
  if (status === "PARTIAL") return { key: "PARTIAL", label: "Partly paid", tone: "amber", paid, balance, dueOn: order.dueOn ?? null, overdueDays: 0, status };
  return { key: "UNPAID", label: "Unpaid", tone: "gray", paid, balance, dueOn: order.dueOn ?? null, overdueDays: 0, status };
}
