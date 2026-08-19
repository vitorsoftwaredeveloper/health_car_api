import { Schema } from "mongoose";
import { AttachmentDocument } from "../types/maintenance";

export const attachmentSchema = new Schema<AttachmentDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "vehicles", required: true },
    s3Key: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, default: null },
    type: {
      type: String,
      enum: ["receipt", "invoice", "photo", "manual", "document"],
      required: true,
    },
    link: {
      type: new Schema(
        {
          collection: { type: String, required: true },
          documentId: { type: Schema.Types.ObjectId, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "users", required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "attachments",
  },
);

attachmentSchema.index({ vehicleId: 1, createdAt: -1 });
attachmentSchema.index({ "link.documentId": 1 });
