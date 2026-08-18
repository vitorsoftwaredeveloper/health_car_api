import { Schema } from "mongoose";
import { OdometerReadingDocument } from "../types/odometer";

export const odometerReadingSchema = new Schema<OdometerReadingDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "vehicles", required: true },
    km: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    source: {
      type: String,
      enum: ["manual", "service", "refuel", "correction"],
      default: "manual",
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    correctsId: {
      type: Schema.Types.ObjectId,
      ref: "odometerReadings",
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "users", required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "odometerReadings",
  },
);

odometerReadingSchema.index({ vehicleId: 1, date: -1 });
odometerReadingSchema.index({ correctsId: 1 });
