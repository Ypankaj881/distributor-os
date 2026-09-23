// GST maths — used for product display now, and by the cart and order totals
// later, so the numbers a shop sees always match what the order will charge.
//
// pricesIncludeGst (company setting):
//   false (default) → price is BEFORE GST; GST is added on top.
//   true            → price already INCLUDES GST; GST is the part inside it.
export function splitGst(amountPaise, gstRate, pricesIncludeGst = false) {
  if (pricesIncludeGst) {
    const gst = Math.round((amountPaise * gstRate) / (100 + gstRate));
    return { taxable: amountPaise - gst, gst, total: amountPaise };
  }
  const gst = Math.round((amountPaise * gstRate) / 100);
  return { taxable: amountPaise, gst, total: amountPaise + gst };
}

// "box of 10" / "piece"
export function unitLabel(unit, packSize) {
  return packSize ? `${unit} of ${packSize}` : unit;
}
