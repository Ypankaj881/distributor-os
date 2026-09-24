import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, teardownTestDb, makeCompany, makeAdmin, makeShop, makeBrand, makeProduct, rejectsWith } from "./helpers.js";
import { previewOrderForShop, createOrderForShop, listShopOrders, getShopOrder } from "../src/server/services/orderService.js";
import { setCartItem, getCartView } from "../src/server/services/cartService.js";
import { setCustomerPrices } from "../src/server/services/pricingService.js";
import { setCustomerActive } from "../src/server/services/customerService.js";
import { getProduct } from "../src/server/services/productService.js";
import { newUuid } from "../src/lib/uuid.js";

let co, other, admin, otherAdmin, brand, p1, shop, foreignShop;

before(async () => {
  await setupTestDb();
  co = await makeCompany("adm-co");
  other = await makeCompany("adm-other");
  admin = await makeAdmin(co);
  otherAdmin = await makeAdmin(other);
  brand = await makeBrand(co);
  p1 = await makeProduct(co, brand, { defaultPrice: 50000, gstRate: 18, stockQuantity: 50, minOrderQty: 2 });
  shop = await makeShop(co);
  foreignShop = await makeShop(other);
  await setCustomerPrices(admin.companyId, shop.customer.id, { prices: [{ productId: p1.id, price: 45000 }] }, { userId: admin.userId, timeZone: "Asia/Kolkata" });
});
after(teardownTestDb);

test("preview prices the lines at the SHOP's price and lists its addresses", async () => {
  const pv = await previewOrderForShop(admin, { customerId: shop.customer.id, items: [{ productId: p1.id, quantity: 3 }] });
  assert.equal(pv.lines[0].price, 45000);
  assert.equal(pv.totals.total, 3 * 45000 * 1.18);
  assert.equal(pv.addresses.length, 1);
  const tooFew = await previewOrderForShop(admin, { customerId: shop.customer.id, items: [{ productId: p1.id, quantity: 1 }] });
  assert.equal(tooFew.canCheckout, false);
});

test("admin order: shop's price, source ADMIN, shop's own cart untouched, visible to the shop", async () => {
  await setCartItem(shop.auth.companyId, shop.auth.customerId, p1.id, 4, {}); // shop has its own cart
  const r = await createOrderForShop(admin, { customerId: shop.customer.id, items: [{ productId: p1.id, quantity: 3 }], idempotencyKey: newUuid(), notes: "phoned in" });
  const o = await getShopOrder(shop.auth.companyId, shop.auth.customerId, r.id);
  assert.equal(o.items[0].unitPrice, 45000);
  assert.equal(o.status, "NEW");
  assert.equal(o.timeline[0].by, "Distributor");
  assert.equal((await getCartView(shop.auth.companyId, shop.auth.customerId, {})).lines[0].quantity, 4, "cart untouched");
  assert.equal((await listShopOrders(shop.auth.companyId, shop.auth.customerId, { page: 1, limit: 10 })).meta.total, 1);
});

test("confirm right away deducts stock; same key twice → one order", async () => {
  const key = newUuid();
  const a = await createOrderForShop(admin, { customerId: shop.customer.id, items: [{ productId: p1.id, quantity: 5 }], idempotencyKey: key, confirmNow: true });
  const b = await createOrderForShop(admin, { customerId: shop.customer.id, items: [{ productId: p1.id, quantity: 5 }], idempotencyKey: key, confirmNow: true });
  assert.equal(a.id, b.id);
  assert.equal(b.duplicate, true);
  assert.equal((await getProduct(admin.companyId, p1.id)).stockQuantity, 45, "deducted once");
  const o = await getShopOrder(shop.auth.companyId, shop.auth.customerId, a.id);
  assert.equal(o.status, "CONFIRMED");
});

test("refused: inactive shop, another company's shop, over stock", async () => {
  await rejectsWith(createOrderForShop(otherAdmin, { customerId: shop.customer.id, items: [{ productId: p1.id, quantity: 2 }], idempotencyKey: newUuid() }), { status: 404 });
  await rejectsWith(previewOrderForShop(admin, { customerId: foreignShop.customer.id, items: [] }), { status: 404 });
  await rejectsWith(createOrderForShop(admin, { customerId: shop.customer.id, items: [{ productId: p1.id, quantity: 999 }], idempotencyKey: newUuid() }), { code: "CART_HAS_ISSUES" });
  await setCustomerActive(admin.companyId, shop.customer.id, false);
  await rejectsWith(createOrderForShop(admin, { customerId: shop.customer.id, items: [{ productId: p1.id, quantity: 2 }], idempotencyKey: newUuid() }), { status: 403 });
  await setCustomerActive(admin.companyId, shop.customer.id, true);
});
