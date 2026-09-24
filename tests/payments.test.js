import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, teardownTestDb, makeCompany, makeAdmin, makeShop, makeBrand, makeProduct, rejectsWith } from "./helpers.js";
import { createOrderForShop, getShopOrder } from "../src/server/services/orderService.js";
import { confirmOrder, transitionOrder } from "../src/server/services/orderWorkflow.js";
import { recordPayment, voidPayment, customerBalance, companyReceivables } from "../src/server/services/paymentService.js";
import { listAdminOrders } from "../src/server/services/adminOrderService.js";
import { updateCustomer } from "../src/server/services/customerService.js";
import { paymentState, derivePaymentStatus } from "../src/lib/payments.js";
import { todayIn, addDays } from "../src/lib/dates.js";
import { Order } from "../src/server/models/Order.js";
import { Company } from "../src/server/models/Company.js";
import { newUuid } from "../src/lib/uuid.js";

const TZ = "Asia/Kolkata";
let co, other, admin, otherAdmin, actor, brand, p, shop, shop2;

async function deliveredOrder(forShop, qty = 10, { deliver = true } = {}) {
  const { id } = await createOrderForShop(admin, { customerId: forShop.customer.id, items: [{ productId: p.id, quantity: qty }], idempotencyKey: newUuid(), confirmNow: true });
  if (deliver) for (const s of ["PACKED", "DISPATCHED", "DELIVERED"]) await transitionOrder(admin.companyId, id, { status: s }, actor);
  return id;
}
const pay = (id, amount, extra = {}) => recordPayment(admin.companyId, id, { amount, mode: "UPI", ...extra }, actor, { timeZone: TZ });

before(async () => {
  await setupTestDb();
  co = await makeCompany("pay-co", { defaultCreditDays: 7 });
  other = await makeCompany("pay-other");
  admin = await makeAdmin(co);
  otherAdmin = await makeAdmin(other);
  actor = { userId: admin.userId, name: admin.name, role: admin.role };
  brand = await makeBrand(co);
  p = await makeProduct(co, brand, { defaultPrice: 10000, gstRate: 0, stockQuantity: 10000 }); // ₹100, no GST → easy totals
  shop = await makeShop(co);
  shop2 = await makeShop(co);
  await updateCustomer(admin.companyId, shop2.customer.id, { creditDays: 15 });
});
after(teardownTestDb);

describe("status rules (pure)", () => {
  test("derivePaymentStatus / paymentState", () => {
    assert.equal(derivePaymentStatus(0, 1000), "UNPAID");
    assert.equal(derivePaymentStatus(400, 1000), "PARTIAL");
    assert.equal(derivePaymentStatus(1000, 1000), "PAID");
    const today = "2026-10-10";
    assert.equal(paymentState({ status: "DELIVERED", grandTotal: 1000, amountPaid: 0, dueOn: "2026-10-10" }, today).key, "UNPAID", "due today is not overdue yet");
    const od = paymentState({ status: "DELIVERED", grandTotal: 1000, amountPaid: 400, dueOn: "2026-10-07" }, today);
    assert.deepEqual([od.key, od.overdueDays, od.balance], ["OVERDUE", 3, 600]);
    assert.equal(paymentState({ status: "DELIVERED", grandTotal: 1000, amountPaid: 1000, dueOn: "2026-01-01" }, today).key, "PAID");
    assert.equal(paymentState({ status: "CANCELLED", grandTotal: 1000, amountPaid: 0 }, today).key, "NA");
    assert.equal(paymentState({ status: "CONFIRMED", grandTotal: 1000, amountPaid: 0, dueOn: null }, today).key, "UNPAID", "not delivered → not overdue");
  });
});

describe("due dates", () => {
  test("set on delivery from the shop's credit days, else the company default", async () => {
    const a = await Order.findById(await deliveredOrder(shop)).lean();
    const b = await Order.findById(await deliveredOrder(shop2)).lean();
    const today = todayIn(TZ);
    assert.deepEqual([a.creditDays, a.dueOn], [7, addDays(today, 7)]);
    assert.deepEqual([b.creditDays, b.dueOn], [15, addDays(today, 15)]);
    const notYet = await Order.findById(await deliveredOrder(shop, 1, { deliver: false })).lean();
    assert.equal(notYet.dueOn, null);
  });
});

describe("recording payments", () => {
  test("partial → paid; overpaying is refused", async () => {
    const id = await deliveredOrder(shop, 10); // ₹1,000
    let o = await pay(id, 40000, { reference: "UPI123" });
    assert.deepEqual([o.paymentStatus, o.amountPaid], ["PARTIAL", 40000]);
    const err = await rejectsWith(pay(id, 70000), { status: 400 });
    assert.match(err.fields.amount, /Balance is only ₹600/);
    o = await pay(id, 60000, { mode: "CASH" });
    assert.deepEqual([o.paymentStatus, o.amountPaid, o.payments.length], ["PAID", 100000, 2]);
    await rejectsWith(pay(id, 1), { status: 400 });
  });

  test("simultaneous payments can never exceed the total", async () => {
    const id = await deliveredOrder(shop, 10); // ₹1,000
    const results = await Promise.allSettled([1, 2, 3, 4].map(() => pay(id, 40000)));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
    const o = await Order.findById(id).lean();
    assert.deepEqual([o.amountPaid, o.paymentStatus], [80000, "PARTIAL"]);
  });

  test("voiding keeps history and recalculates", async () => {
    const id = await deliveredOrder(shop, 5); // ₹500
    const o1 = await pay(id, 50000);
    assert.equal(o1.paymentStatus, "PAID");
    const o2 = await voidPayment(admin.companyId, id, String(o1.payments[0]._id), { reason: "entered twice" }, actor);
    assert.deepEqual([o2.paymentStatus, o2.amountPaid, o2.payments.length], ["UNPAID", 0, 1]);
    assert.equal(o2.payments[0].voidReason, "entered twice");
    await rejectsWith(voidPayment(admin.companyId, id, String(o1.payments[0]._id), { reason: "again" }, actor), { status: 404 });
    // the shop only sees valid payments
    const shopView = await getShopOrder(shop.auth.companyId, shop.auth.customerId, id);
    assert.equal(shopView.payments.length, 0);
  });

  test("cancelled orders can't be paid; future dates refused; other companies can't pay", async () => {
    const { id } = await createOrderForShop(admin, { customerId: shop.customer.id, items: [{ productId: p.id, quantity: 1 }], idempotencyKey: newUuid() });
    await rejectsWith(pay(id, 100, { paidOn: addDays(todayIn(TZ), 2) }), { status: 400 });
    await transitionOrder(admin.companyId, id, { status: "CANCELLED", note: "test" }, actor);
    await rejectsWith(pay(id, 100), { code: "ORDER_CLOSED" });
    await rejectsWith(recordPayment(otherAdmin.companyId, id, { amount: 100, mode: "CASH" }, actor, {}), { status: 404 });
  });

  test("a lower confirmed total re-derives the status (advance now covers it)", async () => {
    const { id } = await createOrderForShop(admin, { customerId: shop.customer.id, items: [{ productId: p.id, quantity: 10 }], idempotencyKey: newUuid() });
    await pay(id, 60000); // ₹600 advance on a ₹1,000 order
    const o = await Order.findById(id).lean();
    const res = await confirmOrder(admin.companyId, id, { quantities: [{ itemId: String(o.items[0]._id), confirmedQty: 6 }] }, actor, {});
    assert.deepEqual([res.grandTotal, res.paymentStatus], [60000, "PAID"]);
  });
});

describe("overdue & outstanding", () => {
  test("overdue list, filters and balances", async () => {
    await Order.deleteMany({ companyId: co._id });
    const fresh = await deliveredOrder(shop, 3); // ₹300, due in 7 days
    const late = await deliveredOrder(shop, 5); // ₹500 → make it overdue by 4 days
    await Order.updateOne({ _id: late }, { $set: { dueOn: addDays(todayIn(TZ), -4) } });
    await pay(late, 20000); // ₹200 paid → ₹300 overdue
    const done = await deliveredOrder(shop2, 2);
    await pay(done, 20000); // fully paid

    const overdue = await listAdminOrders(co._id, { status: "all", payment: "overdue", page: 1, limit: 20 }, { timeZone: TZ });
    assert.deepEqual(overdue.items.map((i) => i.id), [late]);
    const due = await listAdminOrders(co._id, { status: "all", payment: "due", page: 1, limit: 20 }, { timeZone: TZ });
    assert.equal(due.meta.total, 2);
    const paid = await listAdminOrders(co._id, { status: "all", payment: "paid", page: 1, limit: 20 }, { timeZone: TZ });
    assert.deepEqual(paid.items.map((i) => i.id), [done]);

    const bal = await customerBalance(co._id, shop.customer.id, { timeZone: TZ });
    assert.deepEqual([bal.outstanding, bal.overdue, bal.overdueOrders, bal.orders], [60000, 30000, 1, 2]);
    const all = await companyReceivables(co._id, { timeZone: TZ });
    assert.deepEqual([all.outstanding, all.overdue], [60000, 30000]);
    assert.equal((await companyReceivables(other._id, { timeZone: TZ })).outstanding, 0, "other company unaffected");
    void fresh;
  });

  test("company default credit days can be changed", async () => {
    await Company.updateOne({ _id: co._id }, { $set: { "settings.defaultCreditDays": 0 } });
    const o = await Order.findById(await deliveredOrder(shop, 1)).lean();
    assert.equal(o.dueOn, todayIn(TZ), "0 days = due on delivery");
  });
});
