import { Types } from "mongoose";

export type MaintenanceType =
  | "preventive"
  | "corrective"
  | "scheduled"
  | "inspection";

export type MaintenanceSource = "manual" | "quick_log" | "ai_receipt";

export type EventItemAction = "replace" | "repair" | "inspect" | "top_up";

export interface Workshop {
  name?: string | null;
  taxId?: string | null;
  city?: string | null;
  phone?: string | null;
}

export interface EventItem {
  planItemId?: Types.ObjectId | null;
  code?: string | null;
  description: string;
  action: EventItemAction;
  partBrand?: string | null;
  partCents?: number | null;
  laborCents?: number | null;
}

export interface EventAttachment {
  attachmentId: Types.ObjectId;
  type: string;
  fileName: string;
}

export interface MaintenanceEventDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  date: Date;
  km: number;
  type: MaintenanceType;
  workshop?: Workshop | null;
  items: EventItem[];
  laborCents?: number | null;
  totalCents: number;
  note?: string | null;
  attachments: EventAttachment[];
  source: MaintenanceSource;
  createdBy: Types.ObjectId;
  purgeAfter?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AttachmentType =
  | "receipt"
  | "invoice"
  | "photo"
  | "manual"
  | "document";

export interface AttachmentDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  s3Key: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number | null;
  type: AttachmentType;
  link?: { collection: string; documentId: Types.ObjectId } | null;
  uploadedBy: Types.ObjectId;
  purgeAfter?: Date | null;
  createdAt?: Date;
}
