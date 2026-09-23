// Shared constants used by both the server and the UI.
// Keeping them in one place prevents "magic strings" drifting apart.

export const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  RETAILER: "RETAILER",
});

export const ORDER_STATUS = Object.freeze({
  NEW: "NEW",
  CONFIRMED: "CONFIRMED",
  PACKED: "PACKED",
  DISPATCHED: "DISPATCHED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  REJECTED: "REJECTED",
});

export const ORDER_STATUS_LABELS = Object.freeze({
  NEW: "New",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
});

// Which status an order may move to from its current status.
// The server enforces this; the UI uses it to decide which buttons to show.
export const ORDER_TRANSITIONS = Object.freeze({
  NEW: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
});

export const PAYMENT_STATUS = Object.freeze({
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
});

// Suggested units for the product form. The field itself is free text so a
// distributor can add their own (e.g. "strip", "roll").
export const PRODUCT_UNITS = Object.freeze([
  "piece", "box", "packet", "dozen", "carton", "bottle", "set", "kg", "litre",
]);

export const GST_RATES = Object.freeze([0, 5, 12, 18, 28]);

export const PAGE_SIZE = 24;
