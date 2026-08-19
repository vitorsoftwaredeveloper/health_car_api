import { Schema } from "mongoose";
import { MaintenanceEventDocument } from "../types/maintenance";

const workshopSchema = new Schema(
  {
    name: { type: String, default: null, trim: true },
    taxId: { type: String, default: null },
    city: { type: String, default: null, trim: true },
    phone: { type: String, default: null },
  },
  { _id: false },
);

const eventItemSchema = new Schema(
  {
    planItemId: {
      type: Schema.Types.ObjectId,
      ref: "planItems",
      default: null,
    },
    code: { type: String, default: null, uppercase: true },
    description: { type: String, required: true, trim: true },
    action: {
      type: String,
      enum: ["replace", "repair", "inspect", "top_up"],
      required: true,
    },
    partBrand: { type: String, default: null, trim: true },
    partCents: { type: Number, default: null, min: 0 },
    laborCents: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

const eventAttachmentSchema = new Schema(
  {
    attachmentId: {
      type: Schema.Types.ObjectId,
      ref: "attachments",
      required: true,
    },
    type: { type: String, required: true },
    fileName: { type: String, required: true },
  },
  { _id: false },
);

export const maintenanceEventSchema = new Schema<MaintenanceEventDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "vehicles", required: true },
    date: { type: Date, required: true },
    km: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: ["preventive", "corrective", "scheduled", "inspection"],
      required: true,
    },
    workshop: { type: workshopSchema, default: null },
    items: { type: [eventItemSchema], default: [] },
    laborCents: { type: Number, default: null, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    note: { type: String, default: null },
    attachments: { type: [eventAttachmentSchema], default: [] },
    source: {
      type: String,
      enum: ["manual", "quick_log", "ai_receipt"],
      default: "manual",
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "users", required: true },
  },
  { timestamps: true, collection: "maintenanceEvents" },
);

maintenanceEventSchema.index({ vehicleId: 1, date: -1 });
maintenanceEventSchema.index({ vehicleId: 1, "items.planItemId": 1 });
maintenanceEventSchema.index({ accountId: 1, date: -1 });
