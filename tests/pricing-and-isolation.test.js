import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, teardownTestDb, makeCompany, makeAdmin, makeShop, makeBrand, makeProduct, rejectsWith } from "./helpers.js";
import { resolvePrices, setCustomerPrices, removeCustomerPrice, listCustomerPriceRows } from "../src/server/services/pricingService.js";
import { getProduct, updateProduct, archiveProduct, adjustStock, listProducts } from "../src/server/services/productService.js";
import { updateBrand, deleteBrand, listBrands } from "../src/server/services/brandService.js";
import { getCustomer, updateCustomer, listCustomers, setCustomerActive } from "../src/server/services/customerService.js";
import { listShopProducts, getShopProduct } from "../src/server/services/catalogService.js";
import { CustomerPrice } from "../src/server/models/CustomerPrice.js";
import { Product } from "../src/server/models/Product.js";

const TZ = "Asia/Kolkata";
let A, B, adminA, adminB, brandA, brandB, pA, pB, shop1, shop2, shopB;

before(async () => {
  await setupTestDb();
  A = await makeCompany("alpha");
  B = await makeCompany("beta");
  adminA = await makeAdmin(A);
  adminB = await makeAdmin(B);
  brandA = await makeBrand(A, "Bellavita");
  brandB = await makeBrand(B, "Secret");
  pA = await makeProduct(A, brandA, { defaultPrice: 65000, mrp: 99900 });
  pB = await makeProduct(B, brandB, { defaultPrice: 1000 });
  shop1 = await makeShop(A);
  shop2 = await makeShop(A);
  shopB = await makeShop(B);
});
after(teardownTestDb);

const priceOf = async (companyId, customerId, product, at) => {
  const doc = await Product.findById(product.id).lean();
  return (await resolvePrices(companyId, customerId, [doc], at)).get(product.id);
};

describe("customer-specific pricing", () => {
  test("no special price → default price", async () => {
    const p = await priceOf(adminA.companyId, shop1.customer.id, pA);
    assert.deepEqual([p.price, p.source], [65000, "DEFAULT"]);
  });

  test("special price applies to that shop only", async () => {
    await setCustomerPrices(adminA.companyId, shop1.customer.id, { prices: [{ productId: pA.id, price: 62000 }] }, { userId: adminA.userId, timeZone: TZ });
    assert.equal((await priceOf(adminA.companyId, shop1.customer.id, pA)).price, 62000);
    assert.equal((await priceOf(adminA.companyId, shop2.customer.id, pA)).price, 65000);
  });

  test("scheduled price takes over in its window, then the running one applies again", async () => {
    await setCustomerPrices(
      adminA.companyId, shop1.customer.id,
      { prices: [{ productId: pA.id, price: 59000 }], effectiveFrom: "2099-10-01", effectiveTo: "2099-10-31" },
      { userId: adminA.userId, timeZone: TZ },
    );
    assert.equal((await priceOf(adminA.companyId, shop1.customer.id, pA)).price, 62000); // today
    assert.equal((await priceOf(adminA.companyId, shop1.customer.id, pA, new Date("2099-10-15T12:00:00+05:30"))).price, 59000);
    assert.equal((await priceOf(adminA.companyId, shop1.customer.id, pA, new Date("2099-10-31T23:59:00+05:30"))).price, 59000); // last day inclusive
    assert.equal((await priceOf(adminA.companyId, shop1.customer.id, pA, new Date("2099-11-01T00:01:00+05:30"))).price, 62000);
  });

  test("a new price 'from now' closes the old one and keeps history", async () => {
    await setCustomerPrices(adminA.companyId, shop1.customer.id, { prices: [{ productId: pA.id, price: 61000 }] }, { userId: adminA.userId, timeZone: TZ });
    assert.equal((await priceOf(adminA.companyId, shop1.customer.id, pA)).price, 61000);
    const history = await CustomerPrice.find({ customerId: shop1.customer.id, productId: pA.id }).lean();
    assert.equal(history.length, 3); // 620 (closed), 590 (scheduled), 610 (current)
    assert.ok(history.find((h) => h.price === 62000).effectiveTo, "old price was closed");
  });

  test("validation: not above MRP, not in the past, end after start", async () => {
    await rejectsWith(setCustomerPrices(adminA.companyId, shop1.customer.id, { prices: [{ productId: pA.id, price: 120000 }] }, { userId: adminA.userId, timeZone: TZ }), { status: 400 });
    await rejectsWith(setCustomerPrices(adminA.companyId, shop1.customer.id, { prices: [{ productId: pA.id, price: 1000 }], effectiveFrom: "2020-01-01" }, { userId: adminA.userId, timeZone: TZ }), { status: 400 });
    await rejectsWith(setCustomerPrices(adminA.companyId, shop1.customer.id, { prices: [{ productId: pA.id, price: 1000 }], effectiveFrom: "2099-05-10", effectiveTo: "2099-05-01" }, { userId: adminA.userId, timeZone: TZ }), { status: 400 });
  });

  test("removing the special price returns to default (current AND scheduled)", async () => {
    await removeCustomerPrice(adminA.companyId, shop1.customer.id, pA.id, { userId: adminA.userId });
    assert.equal((await priceOf(adminA.companyId, shop1.customer.id, pA)).price, 65000);
    assert.equal((await priceOf(adminA.companyId, shop1.customer.id, pA, new Date("2099-10-15T12:00:00+05:30"))).price, 65000);
  });

  test("the shop catalog shows only the shop's own price — never the default or other shops'", async () => {
    await setCustomerPrices(adminA.companyId, shop1.customer.id, { prices: [{ productId: pA.id, price: 62000 }] }, { userId: adminA.userId, timeZone: TZ });
    await setCustomerPrices(adminA.companyId, shop2.customer.id, { prices: [{ productId: pA.id, price: 67000 }] }, { userId: adminA.userId, timeZone: TZ });
    const s1 = await getShopProduct(A._id, shop1.customer.id, pA.id, {});
    const s2 = await getShopProduct(A._id, shop2.customer.id, pA.id, {});
    assert.equal(s1.price, 62000);
    assert.equal(s2.price, 67000);
    const json = JSON.stringify(await listShopProducts(A._id, shop1.customer.id, { page: 1, limit: 20 }, {}));
    for (const leak of ["65000", "67000", "defaultPrice", "stockQuantity", "CUSTOMER", "customerPriceId"]) {
      assert.ok(!json.includes(leak), `shop listing must not contain ${leak}`);
    }
  });
});

describe("tenant isolation: company A can never touch company B's data", () => {
  const A_ = () => adminA.companyId;

  test("products and brands of B are 'not found' for A", async () => {
    await rejectsWith(getProduct(A_(), pB.id), { status: 404 });
    await rejectsWith(updateProduct(A_(), pB.id, { name: "hacked" }), { status: 404 });
    await rejectsWith(archiveProduct(A_(), pB.id), { status: 404 });
    await rejectsWith(adjustStock(A_(), pB.id, 5), { status: 404 });
    await rejectsWith(updateBrand(A_(), brandB.id, { name: "x" }), { status: 404 });
    await rejectsWith(deleteBrand(A_(), brandB.id), { status: 404 });
    // …and creating a product under B's brand is refused
    await rejectsWith(makeProduct(A, brandB), { status: 404 });
  });

  test("customers and prices of B are 'not found' for A", async () => {
    await rejectsWith(getCustomer(A_(), shopB.customer.id), { status: 404 });
    await rejectsWith(updateCustomer(A_(), shopB.customer.id, { notes: "x" }), { status: 404 });
    await rejectsWith(setCustomerActive(A_(), shopB.customer.id, false), { status: 404 });
    await rejectsWith(listCustomerPriceRows(A_(), shopB.customer.id, { page: 1, limit: 10, view: "all" }), { status: 404 });
    await rejectsWith(setCustomerPrices(A_(), shopB.customer.id, { prices: [{ productId: pA.id, price: 1 }] }, { userId: adminA.userId, timeZone: TZ }), { status: 404 });
    // A's shop can't be given a price on B's product
    await rejectsWith(setCustomerPrices(A_(), shop1.customer.id, { prices: [{ productId: pB.id, price: 500 }] }, { userId: adminA.userId, timeZone: TZ }), { status: 400 });
  });

  test("lists never include the other company's records", async () => {
    const products = await listProducts(A_(), { page: 1, limit: 100, status: "all" });
    assert.ok(products.items.every((p) => p.id !== pB.id));
    assert.ok((await listBrands(A_())).every((b) => b.id !== brandB.id));
    const customers = await listCustomers(A_(), { page: 1, limit: 100, status: "all" });
    assert.ok(customers.items.every((c) => c.id !== shopB.customer.id));
    const shopView = await listShopProducts(A._id, shop1.customer.id, { page: 1, limit: 100 }, {});
    assert.ok(shopView.items.every((p) => p.id !== pB.id));
    // a shop of A asking for B's product
    await rejectsWith(getShopProduct(A._id, shop1.customer.id, pB.id, {}), { status: 404 });
  });

  test("a price set by B for B's shop does not affect A (same product id space)", async () => {
    await setCustomerPrices(adminB.companyId, shopB.customer.id, { prices: [{ productId: pB.id, price: 500 }] }, { userId: adminB.userId, timeZone: TZ });
    const doc = await Product.findById(pB.id).lean();
    const fromA = await resolvePrices(A._id, shopB.customer.id, [doc]);
    assert.equal(fromA.get(pB.id).source, "DEFAULT");
  });
});
