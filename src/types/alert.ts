import { Types } from "mongoose";
import { AlertSeverity } from "../domain/alerts";

export type AlertStatus =
  | "pending"
  | "read"
  | "resolved"
  | "snoozed"
  | "dismissed";

export interface AlertDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  planItemId: Types.ObjectId;
  cycle: number;
  milestone: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  dueDate?: Date | null;
  kmRemaining?: number | null;
  daysRemaining?: number | null;
  status: AlertStatus;
  readAt?: Date | null;
  resolvedAt?: Date | null;
  resolvedByEventId?: Types.ObjectId | null;
  snoozedUntil?: Date | null;
  createdAt?: Date;
}
