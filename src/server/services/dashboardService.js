import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Order } from "../models/Order.js";
import { Customer } from "../models/Customer.js";
import { Product } from "../models/Product.js";
import { toId } from "../utils.js";
import { countOrdersByStatus, listAdminOrders } from "./adminOrderService.js";
import { companyReceivables } from "./paymentService.js";
import { ORDER_STATUS } from "../../lib/constants.js";
import { startOfDay, todayIn, addDays } from "../../lib/dates.js";

// Dashboard numbers. Definitions (shown in the UI too):
//  - "Sales" = grand total of orders PLACED in the period, excluding cancelled
//    and rejected orders. (Confirmed quantities are used once an order is
//    confirmed, since confirmation recalculates its total.)
//  - Days are calendar days in the company's timezone, not the server's.

const CHART_DAYS = 14;
const NOT_SALES = [ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED];

export async function getDashboard(companyId, settings = {}) {
  await connectDB();
  const tz = settings.timezone ?? "Asia/Kolkata";
  const threshold = settings.lowStockThreshold ?? 10;
  const cid = new mongoose.Types.ObjectId(String(companyId));

  const today = todayIn(tz);
  const monthStart = startOfDay(`${today.slice(0, 8)}01`, tz);
  const firstChartDay = addDays(today, -(CHART_DAYS - 1));
  const chartStart = startOfDay(firstChartDay, tz);
  const salesAmount = { $cond: [{ $in: ["$status", NOT_SALES] }, 0, "$grandTotal"] };
  const receivedAmount = { $cond: [{ $in: ["$status", NOT_SALES] }, 0, { $ifNull: ["$amountPaid", 0] }] };
  // Part of "remaining" that sits in NEW orders (not yet confirmed by the distributor).
  const remainingInNew = { $cond: [{ $eq: ["$status", ORDER_STATUS.NEW] }, { $subtract: ["$grandTotal", { $ifNull: ["$amountPaid", 0] }] }, 0] };
  const lowStockFilter = { companyId, archivedAt: null, isActive: true, stockQuantity: { $lte: threshold } };

  const [statusCounts, daily, month, activeCustomers, activeProducts, lowStock, lowStockCount, recent, receivables, allTime] = await Promise.all([
    countOrdersByStatus(companyId),
    Order.aggregate([
      { $match: { companyId: cid, createdAt: { $gte: chartStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } },
          orders: { $sum: 1 },
          sales: { $sum: salesAmount },
        },
      },
    ]),
    Order.aggregate([
      { $match: { companyId: cid, createdAt: { $gte: monthStart } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          sales: { $sum: salesAmount },
          received: { $sum: receivedAmount },
          remainingNew: { $sum: remainingInNew },
          delivered: { $sum: { $cond: [{ $eq: ["$status", ORDER_STATUS.DELIVERED] }, 1, 0] } },
        },
      },
    ]),
    Customer.countDocuments({ companyId, isActive: true }),
    Product.countDocuments({ companyId, archivedAt: null, isActive: true }),
    Product.find(lowStockFilter).select("name sku stockQuantity unit").sort({ stockQuantity: 1, name: 1 }).limit(6).lean(),
    Product.countDocuments(lowStockFilter),
    listAdminOrders(companyId, { status: "all", page: 1, limit: 6 }, { timeZone: tz }),
    companyReceivables(companyId, { timeZone: tz }),
    Order.aggregate([
      { $match: { companyId: cid, status: { $nin: NOT_SALES } } },
      { $group: { _id: null, orders: { $sum: 1 }, sales: { $sum: "$grandTotal" }, received: { $sum: { $ifNull: ["$amountPaid", 0] } }, remainingNew: { $sum: remainingInNew } } },
    ]),
  ]);

  // Zero-fill days without orders so the chart has no gaps.
  const byDay = new Map(daily.map((d) => [d._id, d]));
  const days = Array.from({ length: CHART_DAYS }, (_, i) => {
    const date = addDays(firstChartDay, i);
    const d = byDay.get(date);
    return { date, orders: d?.orders ?? 0, sales: d?.sales ?? 0 };
  });
  const todayRow = days[days.length - 1];
  const m = month[0] ?? { orders: 0, sales: 0, received: 0, remainingNew: 0, delivered: 0 };
  const all = allTime[0] ?? { orders: 0, sales: 0, received: 0, remainingNew: 0 };
  const money = (x) => ({ sales: x.sales, received: x.received, remaining: Math.max(x.sales - x.received, 0), remainingNew: x.remainingNew });

  return {
    today: { date: today, orders: todayRow.orders, sales: todayRow.sales },
    month: { orders: m.orders, sales: m.sales, delivered: m.delivered },
    // Sales vs money received. Sales = orders except cancelled/rejected.
    money: { month: money(m), allTime: { ...money(all), orders: all.orders } },
    pipeline: {
      NEW: statusCounts.NEW,
      CONFIRMED: statusCounts.CONFIRMED,
      PACKED: statusCounts.PACKED,
      DISPATCHED: statusCounts.DISPATCHED,
    },
    activeCustomers,
    activeProducts,
    lowStock: {
      threshold,
      count: lowStockCount,
      items: lowStock.map((p) => ({ id: toId(p._id), name: p.name, sku: p.sku, stockQuantity: p.stockQuantity, unit: p.unit })),
    },
    days,
    receivables,
    todayKey: today, // "YYYY-MM-DD" — for payment badges (NOT `today`, which holds today's numbers)
    recentOrders: recent.items,
  };
}
