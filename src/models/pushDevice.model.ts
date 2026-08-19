import { Schema } from "mongoose";
import { PushDeviceDocument } from "../types/notification";

export const pushDeviceSchema = new Schema<PushDeviceDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
    endpoint: { type: String, required: true },
    keys: {
      type: new Schema(
        {
          p256dh: { type: String, required: true },
          auth: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    userAgent: { type: String, default: null },
    standalone: { type: Boolean, default: false, required: true },
    active: { type: Boolean, default: true, required: true },
    lastSentAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "pushDevices",
  },
);

pushDeviceSchema.index({ endpoint: 1 }, { unique: true });
pushDeviceSchema.index({ userId: 1, active: 1 });
