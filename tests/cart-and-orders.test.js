import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, teardownTestDb, makeCompany, makeAdmin, makeShop, makeBrand, makeProduct, rejectsWith } from "./helpers.js";
import { setCartItem, getCartView } from "../src/server/services/cartService.js";
import { placeOrderFromCart, getShopOrder } from "../src/server/services/orderService.js";
import { setCustomerPrices } from "../src/server/services/pricingService.js";
import { updateProduct, adjustStock, getProduct } from "../src/server/services/productService.js";
import { Cart } from "../src/server/models/Cart.js";
import { Order } from "../src/server/models/Order.js";
import { newUuid } from "../src/lib/uuid.js";

let co, admin, brand, ceo, pencil, shop, other;

before(async () => {
  await setupTestDb();
  co = await makeCompany("cart-co", { orderPrefix: "CH" });
  admin = await makeAdmin(co);
  brand = await makeBrand(co);
  ceo = await makeProduct(co, brand, { name: "CEO", defaultPrice: 65000, gstRate: 18, minOrderQty: 2, stockQuantity: 100, mrp: 99900 });
  pencil = await makeProduct(co, brand, { name: "Pencil", defaultPrice: 5050, gstRate: 12, stockQuantity: 5 });
  shop = await makeShop(co);
  other = await makeShop(co);
  await setCustomerPrices(admin.companyId, shop.customer.id, { prices: [{ productId: ceo.id, price: 62000 }] }, { userId: admin.userId, timeZone: "Asia/Kolkata" });
});
after(teardownTestDb);

const set = (productId, qty, auth = shop.auth) => setCartItem(auth.companyId, auth.customerId, productId, qty, auth.company.settings);

describe("cart", () => {
  test("totals are computed on the server with the shop's price and GST", async () => {
    await set(ceo.id, 3);
    const view = await set(pencil.id, 4);
    const byName = Object.fromEntries(view.lines.map((l) => [l.name, l]));
    assert.deepEqual([byName.CEO.price, byName.CEO.taxable, byName.CEO.gst, byName.CEO.total], [62000, 186000, 33480, 219480]);
    assert.deepEqual([byName.Pencil.taxable, byName.Pencil.gst, byName.Pencil.total], [20200, 2424, 22624]);
    assert.deepEqual(view.totals, { lineCount: 2, unitCount: 7, subtotal: 206200, gst: 35904, total: 242104 });
    assert.equal(view.canCheckout, true);
  });

  test("minimum order quantity and stock are enforced", async () => {
    await rejectsWith(set(ceo.id, 1), { status: 422, code: "BELOW_MIN_QTY" });
    await rejectsWith(set(pencil.id, 6), { status: 422, code: "INSUFFICIENT_STOCK" });
  });

  test("quantity is SET (idempotent), 0 removes", async () => {
    await set(pencil.id, 2);
    await set(pencil.id, 2);
    let view = await getCartView(shop.auth.companyId, shop.auth.customerId, {});
    assert.equal(view.lines.find((l) => l.name === "Pencil").quantity, 2);
    view = await set(pencil.id, 0);
    assert.equal(view.lines.some((l) => l.name === "Pencil"), false);
  });

  test("parallel adds on a brand-new cart produce exactly one line", async () => {
    await Promise.all([1, 2, 3, 4, 5].map((q) => set(pencil.id, q, other.auth)));
    const cart = await Cart.findOne({ customerId: other.customer.id }).lean();
    assert.equal(cart.items.filter((i) => String(i.productId) === pencil.id).length, 1);
  });

  test("changes after adding (stock drop, deactivation) are flagged and block checkout", async () => {
    await set(pencil.id, 4);
    await adjustStock(admin.companyId, pencil.id, -3); // stock 2 < 4
    let view = await getCartView(shop.auth.companyId, shop.auth.customerId, {});
    assert.equal(view.lines.find((l) => l.name === "Pencil").issues[0].code, "INSUFFICIENT_STOCK");
    assert.equal(view.canCheckout, false);
    await adjustStock(admin.companyId, pencil.id, 3);
    await updateProduct(admin.companyId, pencil.id, { isActive: false });
    view = await getCartView(shop.auth.companyId, shop.auth.customerId, {});
    const line = view.lines.find((l) => l.productId === pencil.id);
    assert.equal(line.issues[0].code, "UNAVAILABLE");
    assert.equal(line.total, 0, "unavailable lines are excluded from totals");
    await updateProduct(admin.companyId, pencil.id, { isActive: true });
  });
});

describe("placing orders", () => {
  test("order snapshots prices/products, clears the cart and doesn't touch stock", async () => {
    const stockBefore = (await getProduct(admin.companyId, ceo.id)).stockQuantity;
    const { order, duplicate } = await placeOrderFromCart(shop.auth, { idempotencyKey: newUuid(), notes: "before 5pm" });
    assert.equal(duplicate, false);
    assert.match(order.orderNumber, /^CH-\d+$/);
    assert.equal(order.status, "NEW");
    assert.equal(order.grandTotal, 242104);
    assert.equal(order.timeline[0].status, "NEW");
    assert.equal((await getCartView(shop.auth.companyId, shop.auth.customerId, {})).lines.length, 0);
    assert.equal((await getProduct(admin.companyId, ceo.id)).stockQuantity, stockBefore);

    // Later product changes must not change the order.
    await updateProduct(admin.companyId, ceo.id, { name: "CEO RENAMED", defaultPrice: 70000 });
    const again = await getShopOrder(shop.auth.companyId, shop.auth.customerId, order.id);
    assert.deepEqual(again.items.map((i) => [i.name, i.unitPrice]).sort(), [["CEO", 62000], ["Pencil", 5050]]);
  });

  test("double submit with the same key → one order (even in parallel)", async () => {
    await set(pencil.id, 1);
    const key = newUuid();
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => placeOrderFromCart(shop.auth, { idempotencyKey: key })));
    const numbers = new Set(results.map((r) => r.order.orderNumber));
    assert.equal(numbers.size, 1);
    assert.equal(results.filter((r) => !r.duplicate).length, 1);
    assert.equal(await Order.countDocuments({ customerId: shop.customer.id, idempotencyKey: key }), 1);
    // retry after success (cart now empty) still returns the order
    const retry = await placeOrderFromCart(shop.auth, { idempotencyKey: key });
    assert.equal(retry.duplicate, true);
  });

  test("the browser's total is only compared, never used", async () => {
    await set(pencil.id, 1);
    await rejectsWith(placeOrderFromCart(shop.auth, { idempotencyKey: newUuid(), expectedTotal: 1 }), { status: 409, code: "PRICE_CHANGED" });
    const view = await getCartView(shop.auth.companyId, shop.auth.customerId, {});
    const { order } = await placeOrderFromCart(shop.auth, { idempotencyKey: newUuid(), expectedTotal: view.totals.total });
    assert.equal(order.grandTotal, view.totals.total);
  });

  test("empty cart, cart with issues, and other shops' orders are refused", async () => {
    await rejectsWith(placeOrderFromCart(shop.auth, { idempotencyKey: newUuid() }), { code: "CART_EMPTY" });
    await set(pencil.id, 5);
    await adjustStock(admin.companyId, pencil.id, -3);
    await rejectsWith(placeOrderFromCart(shop.auth, { idempotencyKey: newUuid() }), { code: "CART_HAS_ISSUES" });
    const mine = await Order.findOne({ customerId: shop.customer.id }).lean();
    await rejectsWith(getShopOrder(other.auth.companyId, other.auth.customerId, String(mine._id)), { status: 404 });
  });

  test("order numbers are sequential per company", async () => {
    const numbers = (await Order.find({ companyId: co._id }).sort({ createdAt: 1 }).lean()).map((o) => Number(o.orderNumber.split("-")[1]));
    for (let i = 1; i < numbers.length; i++) assert.equal(numbers[i], numbers[i - 1] + 1);
  });
});
