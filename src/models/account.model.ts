import { Schema } from "mongoose";
import { AccountDocument } from "../types/user";

export const DEFAULT_VEHICLE_LIMIT = 3;

export const accountSchema = new Schema<AccountDocument>(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "users", required: true },
    plan: { type: String, enum: ["free", "pro"], default: "free", required: true },
    vehicleLimit: { type: Number, default: DEFAULT_VEHICLE_LIMIT, required: true },
    status: {
      type: String,
      enum: ["active", "pending_deletion", "anonymized"],
      default: "active",
      required: true,
    },
    deletionRequestedAt: { type: Date, default: null },
    purgeAfter: { type: Date, default: null },
  },
  { timestamps: true, collection: "accounts" },
);

accountSchema.index({ status: 1, purgeAfter: 1 });
