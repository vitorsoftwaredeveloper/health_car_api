import { Schema } from "mongoose";
import { KM_PER_DAY_FALLBACK } from "../domain/constants";
import { VehicleDocument } from "../types/vehicle";

const driverSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
    role: { type: String, enum: ["owner", "driver", "admin"], required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

export const vehicleSchema = new Schema<VehicleDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    nickname: { type: String, required: true, trim: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    trim: { type: String, default: null, trim: true },
    manufactureYear: { type: Number, required: true },
    modelYear: { type: Number, required: true },
    engine: { type: String, default: null, trim: true },
    fuel: {
      type: String,
      enum: ["flex", "gasoline", "ethanol", "diesel", "cng", "hybrid", "electric"],
      required: true,
    },
    transmission: {
      type: String,
      enum: ["manual", "automatic", "cvt", "automated", null],
      default: null,
    },
    plate: { type: String, required: true },
    plateHash: { type: String, required: true },
    vin: { type: String, default: null },
    color: { type: String, default: null, trim: true },
    photoKey: { type: String, default: null },
    currentOdometer: { type: Number, required: true, min: 0 },
    currentOdometerAt: { type: Date, required: true },
    kmPerDay: { type: Number, default: KM_PER_DAY_FALLBACK, required: true },
    healthScore: { type: Number, default: 100, required: true },
    drivers: { type: [driverSchema], default: [] },
    status: {
      type: String,
      enum: ["active", "sold", "archived"],
      default: "active",
      required: true,
    },
  },
  { timestamps: true, collection: "vehicles" },
);

vehicleSchema.index({ accountId: 1, status: 1 });
vehicleSchema.index({ "drivers.userId": 1 });
vehicleSchema.index({ accountId: 1, plateHash: 1 }, { unique: true });
