import { Schema } from "mongoose";
import { AlertDocument } from "../types/alert";

export const alertSchema = new Schema<AlertDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "vehicles", required: true },
    planItemId: {
      type: Schema.Types.ObjectId,
      ref: "planItems",
      required: true,
    },
    cycle: { type: Number, required: true },
    milestone: { type: String, required: true },
    severity: {
      type: String,
      enum: ["info", "warning", "urgent"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    dueDate: { type: Date, default: null },
    kmRemaining: { type: Number, default: null },
    daysRemaining: { type: Number, default: null },
    status: {
      type: String,
      enum: ["pending", "read", "resolved", "snoozed", "dismissed"],
      default: "pending",
      required: true,
    },
    readAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedByEventId: {
      type: Schema.Types.ObjectId,
      ref: "maintenanceEvents",
      default: null,
    },
    snoozedUntil: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "alerts",
  },
);

alertSchema.index(
  { planItemId: 1, cycle: 1, milestone: 1 },
  { unique: true },
);
alertSchema.index({ accountId: 1, status: 1, createdAt: -1 });
alertSchema.index({ vehicleId: 1, createdAt: -1 });
