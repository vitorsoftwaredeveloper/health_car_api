import { notificationSchema } from "../models/notification.model";
import { NotificationDocument } from "../types/notification";
import { createInstanceMongoose } from "./base";

export const notificationRepository =
  createInstanceMongoose<NotificationDocument>(
    "notifications",
    notificationSchema,
  );
