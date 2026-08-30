import { Schema } from "mongoose";
import { DiagnosticSessionDocument } from "../types/diagnostics";

const troubleCodesSchema = {
  supported: { type: Boolean, required: true },
  codes: { type: [String], default: [] },
};

export const diagnosticSessionSchema = new Schema<DiagnosticSessionDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "vehicles", required: true },
    startedAt: { type: Date, required: true },
    deviceName: { type: String, required: true, trim: true },
    adapterIdentity: { type: String, default: null },
    protocol: { type: String, default: null },
    voltage: { type: Number, default: null },
    malfunctionLightOn: { type: Boolean, default: null },
    storedCodes: { type: Number, default: null },
    troubleCodes: {
      confirmed: troubleCodesSchema,
      pending: troubleCodesSchema,
      permanent: troubleCodesSchema,
    },
    monitors: [
      {
        _id: false,
        name: { type: String, required: true },
        complete: { type: Boolean, required: true },
      },
    ],
    supportedPids: { type: [String], default: [] },
    readings: [
      {
        _id: false,
        command: { type: String, required: true },
        label: { type: String, required: true },
        unit: { type: String, default: "" },
        value: { type: Number, default: null },
        text: { type: String, default: null },
        answered: { type: Boolean, required: true },
        supported: { type: Boolean, required: true },
      },
    ],
    trip: [
      {
        _id: false,
        command: { type: String, required: true },
        label: { type: String, required: true },
        unit: { type: String, default: "" },
        minimum: { type: Number, required: true },
        average: { type: Number, required: true },
        maximum: { type: Number, required: true },
        samples: { type: Number, required: true },
      },
    ],
    sampleCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "users", required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "diagnosticSessions",
  },
);

diagnosticSessionSchema.index({ vehicleId: 1, startedAt: -1 });
diagnosticSessionSchema.index({ accountId: 1, startedAt: -1 });
