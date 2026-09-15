import { Schema } from "mongoose";
import { FuelEntryDocument } from "../types/fuel";

export const fuelEntrySchema = new Schema<FuelEntryDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "vehicles", required: true },
    date: { type: Date, required: true },
    odometerKm: { type: Number, required: true, min: 0 },
    liters: { type: Number, required: true, min: 0 },
    fuelKind: {
      type: String,
      enum: ["gasoline", "ethanol", "diesel", "cng"],
      required: true,
    },
    totalCents: { type: Number, default: null, min: 0 },
    fullTank: { type: Boolean, required: true, default: true },
    odometerReadingId: {
      type: Schema.Types.ObjectId,
      ref: "odometerReadings",
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "users", required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "fuelEntries",
  },
);

fuelEntrySchema.index({ vehicleId: 1, date: -1 });
fuelEntrySchema.index({ accountId: 1 });
