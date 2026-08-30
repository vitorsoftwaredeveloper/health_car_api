import { Schema } from "mongoose";
import { DiagnosticCodeDocument } from "../types/diagnostics";

export const diagnosticCodeSchema = new Schema<DiagnosticCodeDocument>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    explanation: { type: String, required: true },
    severity: {
      type: String,
      enum: ["stop", "soon", "watch"],
      required: true,
    },
    drivable: { type: Boolean, required: true },
    likelyCauses: { type: [String], default: [] },
    catalogItemCode: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "diagnosticCodeCatalog" },
);

diagnosticCodeSchema.index({ code: 1 }, { unique: true });
