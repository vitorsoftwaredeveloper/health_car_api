import { JSONSchemaType } from "ajv";
import { CreateAttachmentPayload } from "../../services/maintenance/attachment.service";

export const createAttachmentSchema: JSONSchemaType<CreateAttachmentPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    fileName: { type: "string", minLength: 1, maxLength: 200 },
    mimeType: { type: "string", minLength: 3, maxLength: 100 },
    sizeBytes: { type: "integer", minimum: 1, maximum: 52428800, nullable: true },
    type: {
      type: "string",
      enum: ["receipt", "invoice", "photo", "manual", "document"],
      nullable: true,
    },
  },
  required: ["fileName", "mimeType"],
};
