// One-time, safe to re-run: prepares orders created before the payments
// feature (no amountPaid / payments / dueOn fields).
//   npm run migrate:payments        (development)
//   npm run migrate:payments:prod   (production)
// Delivered orders get a due date = delivery day + the shop's credit days.
import { runScript } from "./_shared.js";
import { Order } from "../src/server/models/Order.js";
import { Customer } from "../src/server/models/Customer.js";
import { Company } from "../src/server/models/Company.js";
import { addDays, dateKey } from "../src/lib/dates.js";

await runScript(async () => {
  const filled = await Order.collection.updateMany(
    { amountPaid: { $exists: false } },
    { $set: { amountPaid: 0, payments: [], paymentStatus: "UNPAID" } },
  );
  let dated = 0;
  const legacyDelivered = await Order.find({ status: "DELIVERED", dueOn: null }).select("companyId customerId timeline").lean();
  for (const o of legacyDelivered) {
    const [customer, company] = await Promise.all([
      Customer.findOne({ _id: o.customerId, companyId: o.companyId }).select("creditDays").lean(),
      Company.findById(o.companyId).select("settings").lean(),
    ]);
    const tz = company?.settings?.timezone ?? "Asia/Kolkata";
    const deliveredAt = [...o.timeline].reverse().find((t) => t.status === "DELIVERED")?.at ?? new Date();
    const creditDays = customer?.creditDays ?? company?.settings?.defaultCreditDays ?? 0;
    await Order.collection.updateOne({ _id: o._id }, { $set: { dueOn: addDays(dateKey(deliveredAt, tz), creditDays), creditDays } });
    dated += 1;
  }
  console.log(`✔ ${filled.modifiedCount} order(s) given payment fields, ${dated} delivered order(s) given a due date.`);
});
