import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Order } from "../models/Order.js";
import { AppError, Errors } from "../http/errors.js";
import { assertObjectId } from "../utils.js";
import { ORDER_STATUS } from "../../lib/constants.js";
import { todayIn } from "../../lib/dates.js";
import { formatINR } from "../../lib/money.js";

// Orders that can't be paid for (nothing to collect).
const CLOSED = [ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED];
// Orders that count as money owed: confirmed onwards (NEW isn't agreed yet).
const BILLABLE = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKED, ORDER_STATUS.DISPATCHED, ORDER_STATUS.DELIVERED];

// Mongo expression: status derived from amountPaid vs grandTotal (same rule as lib/payments.js).
const statusExpr = {
  $switch: {
    branches: [
      { case: { $lte: ["$amountPaid", 0] }, then: "UNPAID" },
      { case: { $gte: ["$amountPaid", "$grandTotal"] }, then: "PAID" },
    ],
    default: "PARTIAL",
  },
};

/**
 * Records a payment received for an order.
 * One atomic update: it adds the payment, raises amountPaid and re-derives the
 * status — and only if it would NOT exceed the order total. Two people
 * recording at the same moment can therefore never overpay the order.
 */
export async function recordPayment(companyId, orderId, { amount, mode, paidOn, reference = "", note = "" }, actor, { timeZone = "Asia/Kolkata" } = {}) {
  await connectDB();
  assertObjectId(orderId, "Order");
  const today = todayIn(timeZone);
  const date = paidOn || today;
  if (date > today) throw Errors.validation({ paidOn: "Payment date can't be in the future." });

  const payment = {
    _id: new mongoose.Types.ObjectId(),
    amount, mode, paidOn: date, reference, note,
    recordedAt: new Date(), recordedBy: new mongoose.Types.ObjectId(String(actor.userId)), recordedByName: actor.name,
    voidedAt: null, voidedByName: "", voidReason: "",
  };

  const updated = await Order.findOneAndUpdate(
    {
      _id: orderId,
      companyId,
      status: { $nin: CLOSED },
      $expr: { $lte: [{ $add: ["$amountPaid", amount] }, "$grandTotal"] },
    },
    [
      { $set: { amountPaid: { $add: ["$amountPaid", amount] }, payments: { $concatArrays: ["$payments", [payment]] } } },
      { $set: { paymentStatus: statusExpr } },
    ],
    { returnDocument: "after", updatePipeline: true },
  ).lean();

  if (!updated) {
    const order = await Order.findOne({ _id: orderId, companyId }).select("status grandTotal amountPaid").lean();
    if (!order) throw Errors.notFound("Order");
    if (CLOSED.includes(order.status)) throw new AppError("This order is cancelled — there is nothing to collect.", { status: 409, code: "ORDER_CLOSED" });
    const balance = order.grandTotal - order.amountPaid;
    throw Errors.validation(
      { amount: balance > 0 ? `Balance is only ${formatINR(balance)}.` : "This order is already fully paid." },
      "Amount is more than the balance due.",
    );
  }
  return updated;
}

// Marks a payment as void (typing mistake, bounced cheque…). It stays in the
// history with the reason; totals and status are recalculated.
export async function voidPayment(companyId, orderId, paymentId, { reason }, actor) {
  await connectDB();
  assertObjectId(orderId, "Order");
  assertObjectId(paymentId, "Payment");

  const updated = await Order.findOneAndUpdate(
    { _id: orderId, companyId, payments: { $elemMatch: { _id: paymentId, voidedAt: null } } },
    [
      {
        $set: {
          payments: {
            $map: {
              input: "$payments",
              as: "p",
              in: {
                $cond: [
                  { $eq: ["$$p._id", new mongoose.Types.ObjectId(paymentId)] },
                  { $mergeObjects: ["$$p", { voidedAt: "$$NOW", voidedByName: actor.name, voidReason: reason }] },
                  "$$p",
                ],
              },
            },
          },
        },
      },
      {
        $set: {
          amountPaid: {
            $sum: { $map: { input: { $filter: { input: "$payments", as: "p", cond: { $eq: ["$$p.voidedAt", null] } } }, as: "p", in: "$$p.amount" } },
          },
        },
      },
      { $set: { paymentStatus: statusExpr } },
    ],
    { returnDocument: "after", updatePipeline: true },
  ).lean();

  if (!updated) throw Errors.notFound("Payment");
  return updated;
}

// Money owed by one shop: billable orders not fully paid.
export async function customerBalance(companyId, customerId, { timeZone = "Asia/Kolkata" } = {}) {
  await connectDB();
  const [row] = await Order.aggregate(balancePipeline({ companyId, customerId }, todayIn(timeZone)));
  return shapeBalance(row);
}

// Money owed to the company in total (dashboard).
export async function companyReceivables(companyId, { timeZone = "Asia/Kolkata" } = {}) {
  await connectDB();
  const [row] = await Order.aggregate(balancePipeline({ companyId }, todayIn(timeZone)));
  return shapeBalance(row);
}

function balancePipeline({ companyId, customerId }, today) {
  const match = {
    companyId: new mongoose.Types.ObjectId(String(companyId)),
    status: { $in: BILLABLE },
    paymentStatus: { $ne: "PAID" },
  };
  if (customerId) match.customerId = new mongoose.Types.ObjectId(String(customerId));
  const balance = { $subtract: ["$grandTotal", "$amountPaid"] };
  const overdue = { $and: [{ $ne: ["$dueOn", null] }, { $lt: ["$dueOn", today] }] };
  return [
    { $match: match },
    {
      $group: {
        _id: null,
        outstanding: { $sum: balance },
        orders: { $sum: 1 },
        overdue: { $sum: { $cond: [overdue, balance, 0] } },
        overdueOrders: { $sum: { $cond: [overdue, 1, 0] } },
        oldestDue: { $min: { $cond: [overdue, "$dueOn", null] } },
      },
    },
  ];
}

function shapeBalance(row) {
  return {
    outstanding: row?.outstanding ?? 0,
    orders: row?.orders ?? 0,
    overdue: row?.overdue ?? 0,
    overdueOrders: row?.overdueOrders ?? 0,
    oldestDue: row?.oldestDue ?? null,
  };
}
