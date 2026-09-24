import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, teardownTestDb, makeCompany, makeAdmin, makeShop, makeBrand, makeProduct } from "./helpers.js";
import { createOrderForShop } from "../src/server/services/orderService.js";
import { transitionOrder } from "../src/server/services/orderWorkflow.js";
import { recordPayment } from "../src/server/services/paymentService.js";
import { getDashboard } from "../src/server/services/dashboardService.js";
import { todayIn } from "../src/lib/dates.js";
import { newUuid } from "../src/lib/uuid.js";

let co, admin, actor, p, shop;
before(async () => {
  await setupTestDb();
  co = await makeCompany("dash-co");
  admin = await makeAdmin(co);
  actor = { userId: admin.userId, name: admin.name, role: admin.role };
  const brand = await makeBrand(co);
  p = await makeProduct(co, brand, { defaultPrice: 10000, gstRate: 0, stockQuantity: 1000 }); // ₹100
  shop = await makeShop(co);
});
after(teardownTestDb);

const order = async (qty, confirmNow = true) =>
  (await createOrderForShop(admin, { customerId: shop.customer.id, items: [{ productId: p.id, quantity: qty }], idempotencyKey: newUuid(), confirmNow })).id;

test("today's numbers, and sales vs received vs remaining", async () => {
  const a = await order(10); // ₹1,000 confirmed
  const b = await order(5); // ₹500 confirmed
  await order(2, false); // ₹200 NEW
  const c = await order(3); // ₹300 → cancelled (excluded)
  await transitionOrder(admin.companyId, c, { status: "CANCELLED", note: "test" }, actor);
  await recordPayment(admin.companyId, a, { amount: 100000, mode: "UPI" }, actor, {});
  await recordPayment(admin.companyId, b, { amount: 20000, mode: "CASH" }, actor, {});

  const d = await getDashboard(co._id, co.settings);
  // Regression: `today` must stay the numbers object (it was once overwritten by a date string).
  assert.equal(typeof d.today, "object");
  assert.equal(d.today.orders, 4, "all orders placed today, including the cancelled one");
  assert.equal(d.today.sales, 170000, "cancelled excluded from sales");
  assert.equal(d.todayKey, todayIn("Asia/Kolkata"));

  assert.deepEqual(d.money.allTime, { sales: 170000, received: 120000, remaining: 50000, remainingNew: 20000, orders: 3 });
  assert.deepEqual(d.money.month, { sales: 170000, received: 120000, remaining: 50000, remainingNew: 20000 });
  assert.equal(d.receivables.outstanding, 30000, "to collect = confirmed orders only");
});
