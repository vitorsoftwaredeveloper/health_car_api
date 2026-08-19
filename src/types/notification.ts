import { Types } from "mongoose";

export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

export type NotificationSkipReason =
  | "milestone_disabled"
  | "no_device"
  | "quiet_hours"
  | "push_disabled"
  | "already_sent_today";

export interface NotificationDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  userId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  channel: "push";
  alertIds: Types.ObjectId[];
  title: string;
  body: string;
  deepLink: string;
  status: NotificationStatus;
  skipReason?: NotificationSkipReason | null;
  error?: string | null;
  sentAt?: Date | null;
  createdAt?: Date;
}

export interface PushDeviceDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  userId: Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
  standalone: boolean;
  active: boolean;
  lastSentAt?: Date | null;
  createdAt?: Date;
}
