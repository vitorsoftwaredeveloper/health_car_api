import { attachmentSchema } from "../models/attachment.model";
import { AttachmentDocument } from "../types/maintenance";
import { createInstanceMongoose } from "./base";

export const attachmentRepository = createInstanceMongoose<AttachmentDocument>(
  "attachments",
  attachmentSchema,
);
