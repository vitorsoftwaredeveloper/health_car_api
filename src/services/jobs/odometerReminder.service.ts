import { Types } from "mongoose";
import {
  ODOMETER_REMINDER_INTERVAL_DAYS,
  ODOMETER_STALE_DAYS,
} from "../../domain/constants";
import { enqueueNotifications } from "../../libs/sqs";
import { notificationRepository } from "../../repositories/notification.repository";
import { vehicleRepository } from "../../repositories/vehicle.repository";
import { VehicleDocument } from "../../types/vehicle";
import { addDays, daysBetween, today } from "../../utils/date";
import { NotificationJobMessage } from "../notifications/sendNotifications.service";

const PAGE_SIZE = 50;

export interface OdometerReminderJobResult {
  vehiclesChecked: number;
  remindersEnqueued: number;
  recentlyReminded: number;
}

const loadPage = async (
  staleBefore: Date,
  afterId: Types.ObjectId | null,
): Promise<VehicleDocument[]> => {
  const filter: Record<string, unknown> = {
    status: "active",
    currentOdometerAt: { $lt: staleBefore },
  };
  if (afterId) filter._id = { $gt: afterId };

  return (await vehicleRepository.find(filter, null, {
    sort: { _id: 1 },
    limit: PAGE_SIZE,
  })) as VehicleDocument[];
};

export const runOdometerReminder =
  async (): Promise<OdometerReminderJobResult> => {
    const now = today();
    const staleBefore = addDays(now, -ODOMETER_STALE_DAYS);
    const remindedSince = addDays(now, -ODOMETER_REMINDER_INTERVAL_DAYS);

    const result: OdometerReminderJobResult = {
      vehiclesChecked: 0,
      remindersEnqueued: 0,
      recentlyReminded: 0,
    };

    const messages: NotificationJobMessage[] = [];
    let afterId: Types.ObjectId | null = null;

    for (;;) {
      const vehicles = await loadPage(staleBefore, afterId);
      if (!vehicles.length) break;

      for (const vehicle of vehicles) {
        result.vehiclesChecked += 1;

        const recent = await notificationRepository.count({
          vehicleId: vehicle._id,
          kind: "odometer_reminder",
          status: "sent",
          createdAt: { $gte: remindedSince },
        });

        if (recent > 0) {
          result.recentlyReminded += 1;
          continue;
        }

        messages.push({
          accountId: String(vehicle.accountId),
          vehicleId: String(vehicle._id),
          kind: "odometer_reminder",
          daysSinceReading: daysBetween(now, vehicle.currentOdometerAt),
        });
      }

      afterId = vehicles[vehicles.length - 1]._id as Types.ObjectId;
      if (vehicles.length < PAGE_SIZE) break;
    }

    if (messages.length && process.env.NOTIFICATIONS_QUEUE_URL) {
      await enqueueNotifications(messages);
      result.remindersEnqueued = messages.length;
    }

    return result;
  };
