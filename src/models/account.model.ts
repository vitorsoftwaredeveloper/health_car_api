import { Schema } from "mongoose";
import { AccountDocument } from "../types/user";

export const DEFAULT_VEHICLE_LIMIT = 3;

export const accountSchema = new Schema<AccountDocument>(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "users", required: true },
    plan: { type: String, enum: ["free", "pro"], default: "free", required: true },
    vehicleLimit: { type: Number, default: DEFAULT_VEHICLE_LIMIT, required: true },
  },
  { timestamps: true, collection: "accounts" },
);
