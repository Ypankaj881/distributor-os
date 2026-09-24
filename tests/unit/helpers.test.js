// Pure-function tests (no database). Run fast: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { toPaise, formatINR } from "../../src/lib/money.js";
import { splitGst } from "../../src/lib/tax.js";
import { normalizePhone } from "../../src/lib/phone.js";
import { startOfDay, todayIn, dateKey, addDays } from "../../src/lib/dates.js";
import { escapeRegex, searchTokens, slugify } from "../../src/server/utils.js";
import { buildProductSearchText } from "../../src/server/services/productSearch.js";
import { orderShareText, whatsappUrl } from "../../src/lib/orderShare.js";
import { stockStatus } from "../../src/lib/inventory.js";

test("money: rupees → integer paise without float errors", () => {
  assert.equal(toPaise("650.50"), 65050);
  assert.equal(toPaise(0.1 + 0.2), 30); // 0.30000000000000004 → 30 paise
  assert.equal(toPaise("19.99"), 1999);
  assert.ok(Number.isNaN(toPaise("abc")));
  assert.equal(formatINR(1900000), "₹19,000");
  assert.equal(formatINR(73160), "₹731.60");
});

test("GST: added on top vs included in price", () => {
  assert.deepEqual(splitGst(65000, 18, false), { taxable: 65000, gst: 11700, total: 76700 });
  // ₹767 incl. 18% → taxable ₹650, GST ₹117
  assert.deepEqual(splitGst(76700, 18, true), { taxable: 65000, gst: 11700, total: 76700 });
  assert.deepEqual(splitGst(5050 * 4, 12, false), { taxable: 20200, gst: 2424, total: 22624 });
  assert.deepEqual(splitGst(1000, 0, false), { taxable: 1000, gst: 0, total: 1000 });
  // rounding to the nearest paisa
  assert.equal(splitGst(333, 5, false).gst, 17);
});

test("phone numbers are normalized to 10 digits", () => {
  for (const input of ["9876543210", "+91 98765 43210", "098765-43210", "919876543210"]) {
    assert.equal(normalizePhone(input), "9876543210", input);
  }
  for (const bad of ["12345", "5876543210", "", null, "98765432101"]) assert.equal(normalizePhone(bad), null, String(bad));
});

test("dates: days follow the company timezone (IST), not the server's", () => {
  const tz = "Asia/Kolkata";
  assert.equal(startOfDay("2026-09-24", tz).toISOString(), "2026-09-23T18:30:00.000Z");
  // 00:10 IST on the 24th is 18:40 UTC on the 23rd — it must count as the 24th
  assert.equal(dateKey(new Date("2026-09-23T18:40:00Z"), tz), "2026-09-24");
  assert.equal(dateKey(new Date("2026-09-23T18:20:00Z"), tz), "2026-09-23");
  assert.equal(todayIn(tz, new Date("2026-09-23T19:00:00Z")), "2026-09-24");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("search: user input is escaped, tokens are normalized", () => {
  assert.equal(escapeRegex(".*(a)+"), "\\.\\*\\(a\\)\\+");
  assert.deepEqual(searchTokens("  Bella   CEO "), ["bella", "ceo"]);
  assert.deepEqual(searchTokens(".*("), []);
  assert.equal(slugify("Bella Vita!! "), "bella-vita");
  const text = buildProductSearchText({ name: "CEO Perfume", sku: "BV-CEO-100", brandName: "Bellavita" });
  for (const t of ["ceo", "bv", "bvceo100", "bellavita"]) assert.ok(text.includes(t), t);
});

test("stock status labels", () => {
  assert.equal(stockStatus(0, 10), "out");
  assert.equal(stockStatus(-2, 10), "out");
  assert.equal(stockStatus(10, 10), "low");
  assert.equal(stockStatus(11, 10), "in");
});

test("WhatsApp share text and link", () => {
  const text = orderShareText({
    orderNumber: "CH-1024",
    shopName: "Sharma Store",
    items: [{ name: "CEO", orderedQty: 20, confirmedQty: null, unit: "bottle" }, { name: "HB", orderedQty: 5, confirmedQty: 3, unit: "box" }],
    grandTotal: 1900000,
    notes: "",
  });
  assert.equal(text, "Order CH-1024 — Sharma Store\n\nCEO – 20 bottle\nHB – 3 box\n\nTotal: ₹19,000 (incl. GST)");
  assert.ok(whatsappUrl("a b&c", "9876543210").startsWith("https://wa.me/919876543210?text=a%20b%26c"));
  assert.ok(whatsappUrl("x", null).startsWith("https://wa.me/?text="));
});
