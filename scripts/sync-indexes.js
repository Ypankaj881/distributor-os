// Creates/updates every MongoDB index defined in the models, then lists them.
// Run once when setting up a new database (e.g. production), and after
// changing indexes in a model:   npm run db:indexes
//
// Why it matters: several rules are enforced BY unique indexes — one order per
// checkout key, unique SKU / order number / phone per company, one cart per shop.
import mongoose from "mongoose";
import { runScript } from "./_shared.js";
import "../src/server/models/Company.js";
import "../src/server/models/User.js";
import "../src/server/models/Customer.js";
import "../src/server/models/LoginAttempt.js";
import "../src/server/models/Brand.js";
import "../src/server/models/Product.js";
import "../src/server/models/CustomerPrice.js";
import "../src/server/models/Counter.js";
import "../src/server/models/Cart.js";
import "../src/server/models/Order.js";

await runScript(async () => {
  console.log(`Database: ${mongoose.connection.name}\n`);
  for (const model of Object.values(mongoose.models)) {
    await model.syncIndexes();
    const indexes = await model.collection.indexes();
    const described = indexes
      .filter((i) => i.name !== "_id_")
      .map((i) => `${Object.keys(i.key).join("+")}${i.unique ? " (unique)" : ""}${i.expireAfterSeconds != null ? ` (TTL ${i.expireAfterSeconds}s)` : ""}`);
    console.log(`✔ ${model.modelName.padEnd(14)} ${described.join(" | ")}`);
  }
});
