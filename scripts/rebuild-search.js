// Rebuilds the search text of every product and customer.
// Run after bulk imports or direct database edits:  npm run search:rebuild
import { runScript } from "./_shared.js";
import { Brand } from "../src/server/models/Brand.js";
import { Product } from "../src/server/models/Product.js";
import { Customer } from "../src/server/models/Customer.js";
import { buildProductSearchText } from "../src/server/services/productSearch.js";
import { buildCustomerSearchText } from "../src/server/services/customerService.js";

await runScript(async () => {
  const brandNames = new Map((await Brand.find().select("name").lean()).map((b) => [String(b._id), b.name]));

  const products = await Product.find().select("name sku brandId").lean();
  if (products.length) {
    await Product.bulkWrite(
      products.map((p) => ({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { searchText: buildProductSearchText({ name: p.name, sku: p.sku, brandName: brandNames.get(String(p.brandId)) }) } },
        },
      })),
    );
  }

  const customers = await Customer.find().select("shopName ownerName phone customerCode billingAddress").lean();
  if (customers.length) {
    await Customer.bulkWrite(
      customers.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { searchText: buildCustomerSearchText(c) } } } })),
    );
  }

  console.log(`✔ Rebuilt search text for ${products.length} products and ${customers.length} customers.`);
});
