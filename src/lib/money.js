// All money is stored as INTEGER PAISE (₹650.50 → 65050).
// Floating-point rupees cause rounding bugs (0.1 + 0.2 !== 0.3), which are
// unacceptable on orders and invoices. Convert only at the edges: when reading
// user input (toPaise) and when displaying (formatINR).

export function toPaise(rupees) {
  const n = Number(rupees);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export function fromPaise(paise) {
  return (Number(paise) || 0) / 100;
}

const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// formatINR(1900000) → "₹19,000"   formatINR(73160) → "₹731.60" (never "₹731.6")
export function formatINR(paise) {
  const p = Number(paise) || 0;
  return (p % 100 === 0 ? inrWhole : inrPaise).format(p / 100);
}

// GST for a line, rounded to the nearest paisa. rate is a percentage (e.g. 18).
export function gstOn(amountPaise, rate) {
  return Math.round((amountPaise * rate) / 100);
}
