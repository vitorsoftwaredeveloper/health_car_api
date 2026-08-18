import { Schema } from "mongoose";
import { CATEGORIES } from "../types/catalog";
import { PlanItemDocument } from "../types/plan-item";

export const planItemSchema = new Schema<PlanItemDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "vehicles", required: true },
    catalogItemId: {
      type: Schema.Types.ObjectId,
      ref: "catalogItems",
      default: null,
    },
    code: { type: String, default: null, uppercase: true },
    custom: { type: Boolean, default: false, required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    dueType: {
      type: String,
      enum: ["km", "time", "both", "inspection"],
      required: true,
    },
    intervalKm: { type: Number, default: null },
    intervalMonths: { type: Number, default: null },
    criticality: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      required: true,
    },
    customized: { type: Boolean, default: false, required: true },
    lastServiceKm: { type: Number, default: null },
    lastServiceDate: { type: Date, default: null },
    lastServiceEventId: {
      type: Schema.Types.ObjectId,
      ref: "maintenanceEvents",
      default: null,
    },
    cycle: { type: Number, default: 0, required: true },
    nextDueKm: { type: Number, default: null },
    nextDueDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    dueReason: { type: String, enum: ["km", "time", null], default: null },
    status: {
      type: String,
      enum: ["unknown", "ok", "due_soon", "overdue"],
      default: "unknown",
      required: true,
    },
    leadTimeDays: { type: Number, default: 30, required: true },
    leadTimeKm: { type: Number, default: 500, required: true },
    snoozedUntil: { type: Date, default: null },
    snoozedUntilKm: { type: Number, default: null },
    muted: { type: Boolean, default: false, required: true },
    active: { type: Boolean, default: true, required: true },
    note: { type: String, default: null },
    calculatedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true, collection: "planItems" },
);

planItemSchema.index({ vehicleId: 1, active: 1, dueDate: 1 });
planItemSchema.index(
  { vehicleId: 1, catalogItemId: 1 },
  { unique: true, partialFilterExpression: { catalogItemId: { $type: "objectId" } } },
);
planItemSchema.index({ status: 1, dueDate: 1 });
planItemSchema.index({ calculatedAt: 1 });
