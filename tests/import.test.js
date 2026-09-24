import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, teardownTestDb, makeCompany, makeAdmin, makeBrand, makeProduct, makeShop, rejectsWith } from "./helpers.js";
import { importProducts, importCustomers, importPrices } from "../src/server/services/importService.js";
import { resolvePrices } from "../src/server/services/pricingService.js";
import { login } from "../src/server/services/authService.js";
import { parseDelimited } from "../src/lib/csv.js";
import { Product } from "../src/server/models/Product.js";
import { Brand } from "../src/server/models/Brand.js";
import { Customer } from "../src/server/models/Customer.js";

let co, admin;
before(async () => {
  await setupTestDb();
  co = await makeCompany("imp-co");
  admin = await makeAdmin(co);
});
after(teardownTestDb);

test("CSV parser: quotes, commas in quotes, BOM, CRLF, tabs", () => {
  assert.deepEqual(parseDelimited('﻿a,b\r\n"x, y","say ""hi"""\r\n'), [["a", "b"], ["x, y", 'say "hi"']]);
  assert.deepEqual(parseDelimited("a\tb\n1\t2\n\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseDelimited("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
});

describe("products", () => {
  const csv = [
    "Brand,Product Name,SKU,Unit,Pack Size,MRP,Selling Price,GST %,MOQ,Opening Stock",
    'Natraj,"HB Pencil, dark",nt-hb,box,10,60,"₹50",12,5,400',
    "NewBrand,Thing,NB-1,piece,,0,100,18,1,10",
    "Natraj,Dup,NT-HB,box,,0,10,12,1,1",
    "Natraj,Too pricey,NT-X,box,,50,99,12,1,1",
  ].join("\n");

  test("dry run validates and reports without saving", async () => {
    const r = await importProducts(co._id, csv, { dryRun: true });
    assert.deepEqual([r.summary.create, r.summary.error, r.summary.newBrands], [2, 2, 2]);
    assert.match(r.rows[2].messages[0], /more than once/);
    assert.match(r.rows[3].messages.join(), /more than MRP/);
    assert.equal(await Product.countDocuments({ companyId: co._id }), 0);
  });

  test("import creates products and missing brands; re-import updates but never touches stock", async () => {
    const r = await importProducts(co._id, csv, { dryRun: false });
    assert.equal(r.summary.create, 2);
    const p = await Product.findOne({ companyId: co._id, sku: "NT-HB" }).lean();
    assert.deepEqual([p.name, p.defaultPrice, p.mrp, p.gstRate, p.minOrderQty, p.stockQuantity, p.packSize], ["HB Pencil, dark", 5000, 6000, 12, 5, 400, 10]);
    assert.equal(await Brand.countDocuments({ companyId: co._id }), 2);

    const again = await importProducts(co._id, "brand,name,sku,price,stock\nNatraj,HB Pencil,NT-HB,55,9999", { dryRun: false });
    assert.equal(again.summary.update, 1);
    const p2 = await Product.findOne({ companyId: co._id, sku: "NT-HB" }).lean();
    assert.deepEqual([p2.name, p2.defaultPrice, p2.stockQuantity, p2.mrp], ["HB Pencil", 5500, 400, 6000]);
  });

  test("pasted Excel cells (tab-separated) work; missing columns are explained", async () => {
    const r = await importProducts(co._id, "Brand\tName\tSKU\tPrice\nNatraj\tEraser\tNT-ER\t30", { dryRun: false });
    assert.equal(r.summary.create, 1);
    await rejectsWith(importProducts(co._id, "Brand,Name\nNatraj,Eraser", { dryRun: true }), { status: 400 });
  });
});

describe("shops", () => {
  test("new shops get working logins; existing (same mobile) are updated, password kept", async () => {
    const csv = [
      "Shop Name,Owner,Mobile,City,Pincode,Credit Limit",
      "Sharma Store,Rajesh,+91 98111 00001,Nagpur,440001,50000",
      "Bad Phone Shop,,12345,,,",
    ].join("\n");
    const dry = await importCustomers(co._id, csv, { dryRun: true });
    assert.deepEqual([dry.summary.create, dry.summary.error], [1, 1]);
    assert.equal(dry.logins, undefined, "no passwords in a dry run");

    const r = await importCustomers(co._id, csv, { dryRun: false });
    assert.equal(r.logins.length, 1);
    const { phone, password } = r.logins[0];
    assert.equal(phone, "9811100001");
    assert.ok((await login({ companySlug: co.slug, portal: "shop", identifier: phone, password, ip: "9.9.9.9" })).token);

    const upd = await importCustomers(co._id, "Shop Name,Mobile,City\nSharma General Store,9811100001,Wardha", { dryRun: false });
    assert.equal(upd.summary.update, 1);
    const c = await Customer.findOne({ companyId: co._id, phone }).lean();
    assert.equal(c.shopName, "Sharma General Store");
    assert.equal(c.creditLimit, 5000000, "not blanked by the update");
    assert.ok((await login({ companySlug: co.slug, portal: "shop", identifier: phone, password, ip: "9.9.9.8" })).token, "password unchanged");
  });
});

describe("special prices", () => {
  test("by customer code or mobile; validates product, price and MRP", async () => {
    const brand = await makeBrand(co, "PriceBrand");
    const p = await makeProduct(co, brand, { sku: "PB-1", defaultPrice: 10000, mrp: 15000 });
    const shop = await makeShop(co);
    const code = (await Customer.findById(shop.customer.id).lean()).customerCode;
    const csv = ["Customer,SKU,Price", `${code},PB-1,90`, `${shop.customer.phone},PB-1,95`, `${code},NOPE,50`, `${code},PB-1,200`].join("\n");
    const r = await importPrices(co._id, csv, { dryRun: false, userId: admin.userId, timeZone: "Asia/Kolkata" });
    assert.deepEqual([r.summary.create, r.summary.error], [2, 2]);
    const doc = await Product.findById(p.id).lean();
    const price = (await resolvePrices(co._id, shop.customer.id, [doc])).get(p.id).price;
    assert.ok([9000, 9500].includes(price), "one of the imported prices applies");
  });
});
