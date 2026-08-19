import { Schema } from "mongoose";
import { NotificationDocument } from "../types/notification";

export const notificationSchema = new Schema<NotificationDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "vehicles", required: true },
    channel: { type: String, enum: ["push"], default: "push", required: true },
    alertIds: { type: [Schema.Types.ObjectId], default: [] },
    title: { type: String, required: true },
    body: { type: String, required: true },
    deepLink: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "skipped"],
      default: "pending",
      required: true,
    },
    skipReason: { type: String, default: null },
    error: { type: String, default: null },
    sentAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "notifications",
  },
);

notificationSchema.index({ vehicleId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
