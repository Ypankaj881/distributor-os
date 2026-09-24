import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Order } from "../models/Order.js";
import { Customer } from "../models/Customer.js";
import { Product } from "../models/Product.js";
import { toId } from "../utils.js";
import { countOrdersByStatus, listAdminOrders } from "./adminOrderService.js";
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
  const lowStockFilter = { companyId, archivedAt: null, isActive: true, stockQuantity: { $lte: threshold } };

  const [statusCounts, daily, month, activeCustomers, activeProducts, lowStock, lowStockCount, recent] = await Promise.all([
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
          delivered: { $sum: { $cond: [{ $eq: ["$status", ORDER_STATUS.DELIVERED] }, 1, 0] } },
        },
      },
    ]),
    Customer.countDocuments({ companyId, isActive: true }),
    Product.countDocuments({ companyId, archivedAt: null, isActive: true }),
    Product.find(lowStockFilter).select("name sku stockQuantity unit").sort({ stockQuantity: 1, name: 1 }).limit(6).lean(),
    Product.countDocuments(lowStockFilter),
    listAdminOrders(companyId, { status: "all", page: 1, limit: 6 }, { timeZone: tz }),
  ]);

  // Zero-fill days without orders so the chart has no gaps.
  const byDay = new Map(daily.map((d) => [d._id, d]));
  const days = Array.from({ length: CHART_DAYS }, (_, i) => {
    const date = addDays(firstChartDay, i);
    const d = byDay.get(date);
    return { date, orders: d?.orders ?? 0, sales: d?.sales ?? 0 };
  });
  const todayRow = days[days.length - 1];
  const m = month[0] ?? { orders: 0, sales: 0, delivered: 0 };

  return {
    today: { date: today, orders: todayRow.orders, sales: todayRow.sales },
    month: { orders: m.orders, sales: m.sales, delivered: m.delivered },
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
    recentOrders: recent.items,
  };
}
