import mongoose from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS, ROLES } from "../../lib/constants.js";
import { ObjectId, defineModel } from "./shared.js";

// Items and the status timeline are EMBEDDED in the order:
//  - an order has a bounded number of lines (cart max 200) and they are always
//    read together with the order;
//  - they are snapshots that must not change when products change later;
//  - status + timeline are updated in ONE atomic write, so they can't disagree.

const int = { validator: Number.isInteger, message: "{PATH} must be a whole number." };

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: ObjectId, ref: "Product", required: true },
    // Snapshots at the moment of ordering — the product may be renamed,
    // repriced or deleted later; the order must still read the same.
    name: { type: String, required: true },
    sku: { type: String, required: true },
    brandName: { type: String, default: "" },
    unit: { type: String, required: true },
    packSize: { type: Number, default: null },
    gstRate: { type: Number, required: true },
    unitPrice: { type: Number, required: true, validate: int }, // paise, the shop's price

    orderedQty: { type: Number, required: true, min: 1, validate: int },
    confirmedQty: { type: Number, default: null, validate: { validator: (v) => v == null || Number.isInteger(v) } }, // set on confirmation
    cancelledQty: { type: Number, default: 0, validate: int }, // ordered − confirmed

    // Line amounts in paise, based on the quantity currently charged
    // (ordered qty until confirmation, confirmed qty after).
    taxable: { type: Number, required: true, validate: int },
    gst: { type: Number, required: true, validate: int },
    total: { type: Number, required: true, validate: int },
  },
  { _id: true },
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(ORDER_STATUS), required: true },
    at: { type: Date, default: Date.now },
    byUserId: { type: ObjectId, ref: "User" },
    byName: { type: String, default: "" },
    byRole: { type: String, enum: Object.values(ROLES) },
    note: { type: String, default: "", maxlength: 500 },
  },
  { _id: false },
);

const addressSnapshot = {
  label: String, line1: String, line2: String, landmark: String, city: String, state: String, pincode: String,
};

const orderSchema = new mongoose.Schema(
  {
    companyId: { type: ObjectId, ref: "Company", required: true },
    customerId: { type: ObjectId, ref: "Customer", required: true },
    orderNumber: { type: String, required: true }, // "CH-1024"
    // Where the order came from. WhatsApp / admin-entered orders later use the same model.
    source: { type: String, enum: ["PORTAL", "ADMIN", "WHATSAPP"], default: "PORTAL" },
    placedBy: { type: ObjectId, ref: "User" },
    // Sent by the browser once per checkout; makes "Place order" safe to retry.
    idempotencyKey: { type: String },

    customerSnapshot: {
      shopName: String, ownerName: String, phone: String, customerCode: String, gstin: String,
    },
    shippingAddress: addressSnapshot,

    items: { type: [orderItemSchema], validate: { validator: (v) => v.length > 0, message: "An order needs at least one item." } },
    pricesIncludeGst: { type: Boolean, default: false },
    subtotal: { type: Number, required: true, validate: int }, // taxable value, paise
    discount: { type: Number, default: 0, validate: int },
    gstTotal: { type: Number, required: true, validate: int },
    grandTotal: { type: Number, required: true, validate: int },

    notes: { type: String, default: "", maxlength: 500 },
    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.NEW },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.UNPAID },
    stockDeducted: { type: Boolean, default: false }, // set when confirmed (next phase)

    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true },
);

orderSchema.index({ companyId: 1, orderNumber: 1 }, { unique: true });
// The duplicate-order guard: the same shop can't create two orders with the
// same checkout key. Partial so admin-created orders without a key are fine.
orderSchema.index(
  { companyId: 1, customerId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);
orderSchema.index({ companyId: 1, customerId: 1, createdAt: -1 }); // "My orders"
orderSchema.index({ companyId: 1, status: 1, createdAt: -1 }); // admin order list by status
orderSchema.index({ companyId: 1, createdAt: -1 }); // admin list / dashboard by date

export const Order = defineModel("Order", orderSchema);
