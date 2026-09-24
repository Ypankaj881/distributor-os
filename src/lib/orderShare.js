import { formatINR } from "./money.js";

// Plain-text order summary for WhatsApp, e.g.
//
//   Order CH-1024 — Sharma General Store
//
//   Bellavita CEO – 20 bottle
//   Natraj HB – 5 box
//
//   Total: ₹19,000 (incl. GST)
export function orderShareText(order) {
  const lines = [`Order ${order.orderNumber}${order.shopName ? ` — ${order.shopName}` : ""}`, ""];
  for (const i of order.items) {
    const qty = i.confirmedQty ?? i.orderedQty;
    if (qty > 0) lines.push(`${i.name} – ${qty} ${i.unit}`);
  }
  lines.push("", `Total: ${formatINR(order.grandTotal)} (incl. GST)`);
  if (order.notes) lines.push(`Note: ${order.notes}`);
  return lines.join("\n");
}

// Distributor → shop status update, e.g.
//   "Hello Sharma General Store, your order CH-1024 has been dispatched. Total: ₹19,000."
const STATUS_PHRASE = {
  NEW: "has been received",
  CONFIRMED: "is confirmed",
  PACKED: "is packed and ready",
  DISPATCHED: "has been dispatched",
  DELIVERED: "has been delivered",
  CANCELLED: "has been cancelled",
  REJECTED: "could not be accepted",
};

export function statusMessageText(order, companyName) {
  const lines = [
    `Hello ${order.customer?.shopName ?? order.shopName ?? ""}, your order ${order.orderNumber} ${STATUS_PHRASE[order.status] ?? "was updated"}.`,
    `Total: ${formatINR(order.grandTotal)} (incl. GST)`,
  ];
  const last = order.timeline?.[order.timeline.length - 1];
  if (last?.note && last.status === order.status) lines.push(`Note: ${last.note}`);
  if (companyName) lines.push("", `— ${companyName}`);
  return lines.join("\n");
}

// Opens WhatsApp with the text. With the distributor's number it goes straight
// to their chat; without it, WhatsApp asks whom to send it to.
export function whatsappUrl(text, phone) {
  const to = phone ? `91${phone}` : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
