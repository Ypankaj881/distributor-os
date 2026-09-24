import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, teardownTestDb, makeCompany, makeAdmin, makeShop, makeBrand, makeProduct, rejectsWith } from "./helpers.js";
import { setCartItem } from "../src/server/services/cartService.js";
import { placeOrderFromCart } from "../src/server/services/orderService.js";
import { confirmOrder, transitionOrder } from "../src/server/services/orderWorkflow.js";
import { reorderToCart } from "../src/server/services/reorderService.js";
import { adjustStock, getProduct, updateProduct, archiveProduct } from "../src/server/services/productService.js";
import { Order } from "../src/server/models/Order.js";
import { newUuid } from "../src/lib/uuid.js";

let co, admin, actor, brand, p1, p2, shop, other;
const stock = async (p) => (await getProduct(admin.companyId, p.id)).stockQuantity;

async function placeOrder(lines, who = shop) {
  for (const [p, q] of lines) await setCartItem(who.auth.companyId, who.auth.customerId, p.id, q, {});
  return (await placeOrderFromCart(who.auth, { idempotencyKey: newUuid() })).order;
}

before(async () => {
  await setupTestDb();
  co = await makeCompany("flow-co");
  admin = await makeAdmin(co);
  actor = { userId: admin.userId, name: admin.name, role: admin.role };
  brand = await makeBrand(co);
  p1 = await makeProduct(co, brand, { name: "CEO", defaultPrice: 65000, gstRate: 18, stockQuantity: 20 });
  p2 = await makeProduct(co, brand, { name: "Pencil", defaultPrice: 5000, gstRate: 12, stockQuantity: 3 });
  shop = await makeShop(co);
  other = await makeShop(co);
});
after(teardownTestDb);

describe("order workflow & stock", () => {
  test("confirm fails atomically when any line lacks stock (nothing deducted)", async () => {
    const o = await placeOrder([[p1, 4], [p2, 3]]);
    await adjustStock(admin.companyId, p2.id, -1); // 2 left
    const err = await rejectsWith(confirmOrder(admin.companyId, o.id, {}, actor, {}), { status: 422, code: "INSUFFICIENT_STOCK" });
    assert.ok(Object.values(err.fields)[0].includes("Only 2"));
    assert.equal(await stock(p1), 20, "rolled back");
  });

  test("partial confirmation recalculates totals and deducts confirmed quantities", async () => {
    const o = await Order.findOne({ customerId: shop.customer.id, status: "NEW" }).lean();
    const pencilItem = o.items.find((i) => i.name === "Pencil");
    const res = await confirmOrder(admin.companyId, String(o._id), { quantities: [{ itemId: String(pencilItem._id), confirmedQty: 2 }], note: "short" }, actor, {});
    assert.equal(res.status, "CONFIRMED");
    assert.equal(res.grandTotal, 4 * 65000 * 1.18 + 2 * 5000 * 1.12); // 306800 + 11200
    assert.equal(res.items.find((i) => i.name === "Pencil").cancelledQty, 1);
    assert.match(res.timeline.at(-1).note, /Pencil: 3 → 2/);
    assert.deepEqual([await stock(p1), await stock(p2)], [16, 0]);
    await rejectsWith(confirmOrder(admin.companyId, String(o._id), {}, actor, {}), { status: 409, code: "INVALID_TRANSITION" });
  });

  test("only allowed transitions; cancel after dispatch is refused", async () => {
    const o = await Order.findOne({ customerId: shop.customer.id, status: "CONFIRMED" }).lean();
    const id = String(o._id);
    await rejectsWith(transitionOrder(admin.companyId, id, { status: "DELIVERED" }, actor), { code: "INVALID_TRANSITION" });
    await transitionOrder(admin.companyId, id, { status: "PACKED" }, actor);
    await transitionOrder(admin.companyId, id, { status: "DISPATCHED", note: "vehicle 1" }, actor);
    await rejectsWith(transitionOrder(admin.companyId, id, { status: "CANCELLED", note: "late" }, actor), { code: "INVALID_TRANSITION" });
    const done = await transitionOrder(admin.companyId, id, { status: "DELIVERED" }, actor);
    assert.deepEqual(done.timeline.map((t) => t.status), ["NEW", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"]);
  });

  test("cancelling a confirmed order returns the stock", async () => {
    const o = await placeOrder([[p1, 5]]);
    await confirmOrder(admin.companyId, o.id, {}, actor, {});
    assert.equal(await stock(p1), 11);
    await transitionOrder(admin.companyId, o.id, { status: "CANCELLED", note: "shop closed" }, actor);
    assert.equal(await stock(p1), 16);
  });

  test("three simultaneous confirms deduct stock exactly once", async () => {
    const o = await placeOrder([[p1, 3]]);
    const results = await Promise.allSettled([1, 2, 3].map(() => confirmOrder(admin.companyId, o.id, {}, actor, {})));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await stock(p1), 13);
  });

  test("a shop may cancel only its own NEW order", async () => {
    const o = await placeOrder([[p1, 1]]);
    const shopActor = { userId: shop.auth.userId, name: shop.auth.name, role: shop.auth.role };
    const otherActor = { userId: other.auth.userId, name: other.auth.name, role: other.auth.role };
    await rejectsWith(transitionOrder(co._id, o.id, { status: "CANCELLED" }, otherActor, { customerId: other.customer.id }), { status: 404 });
    await rejectsWith(transitionOrder(co._id, o.id, { status: "PACKED" }, shopActor, { customerId: shop.customer.id }), { status: 409 });
    const cancelled = await transitionOrder(co._id, o.id, { status: "CANCELLED", note: "mistake" }, shopActor, { customerId: shop.customer.id });
    assert.equal(cancelled.status, "CANCELLED");
  });
});

describe("reorder", () => {
  test("uses today's prices/stock and explains every skipped or changed line", async () => {
    const pDeleted = await makeProduct(co, brand, { name: "Gone", stockQuantity: 50 });
    const pLow = await makeProduct(co, brand, { name: "Low", stockQuantity: 50 });
    const pMoq = await makeProduct(co, brand, { name: "Moq", stockQuantity: 50 });
    const o = await placeOrder([[p1, 2], [pDeleted, 2], [pLow, 10], [pMoq, 2]], other);

    await archiveProduct(admin.companyId, pDeleted.id);
    await adjustStock(admin.companyId, pLow.id, -46); // 4 left
    await updateProduct(admin.companyId, pMoq.id, { minOrderQty: 5 });
    await updateProduct(admin.companyId, p1.id, { defaultPrice: 70000 });

    const r = await reorderToCart(other.auth, o.id);
    const added = Object.fromEntries(r.added.map((a) => [a.name, a]));
    assert.deepEqual(r.skipped.map((s) => s.name), ["Gone"]);
    assert.equal(added.Low.quantity, 4);
    assert.equal(added.Moq.quantity, 5);
    assert.deepEqual(added.CEO.priceChange, { from: 65000, to: 70000 });
    assert.equal(r.view.lines.find((l) => l.name === "CEO").price, 70000, "never the old price");
    await rejectsWith(reorderToCart(shop.auth, o.id), { status: 404 }); // someone else's order
  });
});
