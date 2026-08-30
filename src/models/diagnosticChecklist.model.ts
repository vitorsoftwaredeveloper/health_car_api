import { Schema } from "mongoose";
import { DiagnosticChecklistDocument } from "../types/diagnostics";

export const diagnosticChecklistSchema =
  new Schema<DiagnosticChecklistDocument>(
    {
      accountId: {
        type: Schema.Types.ObjectId,
        ref: "accounts",
        required: true,
      },
      vehicleId: {
        type: Schema.Types.ObjectId,
        ref: "vehicles",
        required: true,
      },
      items: [
        {
          _id: false,
          code: { type: String, required: true },
          title: { type: String, required: true },
          why: { type: String, required: true },
          priority: {
            type: String,
            enum: ["now", "soon", "whenever"],
            required: true,
          },
          createdAt: { type: Date, required: true },
          lastSeenAt: { type: Date, required: true },
          doneAt: { type: Date, default: null },
        },
      ],
    },
    {
      timestamps: true,
      collection: "diagnosticChecklists",
    },
  );

diagnosticChecklistSchema.index({ vehicleId: 1 }, { unique: true });
