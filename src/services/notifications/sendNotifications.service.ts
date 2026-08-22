import { Types } from "mongoose";
import {
  buildNotificationContent,
  buildOdometerReminderContent,
  decideNotification,
  decideOdometerReminder,
  NotifiableAlert,
} from "../../domain/notification";
import { ODOMETER_REMINDER_INTERVAL_DAYS } from "../../domain/constants";
import { sendPush } from "../../libs/webpush";
import { alertRepository } from "../../repositories/alert.repository";
import { notificationRepository } from "../../repositories/notification.repository";
import { planItemRepository } from "../../repositories/planItem.repository";
import { pushDeviceRepository } from "../../repositories/pushDevice.repository";
import { userRepository } from "../../repositories/user.repository";
import { vehicleRepository } from "../../repositories/vehicle.repository";
import { AlertDocument } from "../../types/alert";
import {
  NotificationDocument,
  PushDeviceDocument,
} from "../../types/notification";
import { PlanItemDocument } from "../../types/plan-item";
import { UserDocument } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { addDays, today } from "../../utils/date";
import { defaultPreferences } from "../../domain/preferences";

export interface NotificationJobMessage {
  accountId: string;
  vehicleId: string;
  kind?: "alert" | "odometer_reminder";
  alertIds?: string[];
  daysSinceReading?: number;
}

export interface SendNotificationsResult {
  received: number;
  sent: number;
  skipped: number;
  failed: number;
  devicesDeactivated: number;
}

const localTimeIn = (timezone: string, reference = new Date()): string =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(reference);

const loadRecipients = async (
  vehicle: VehicleDocument,
): Promise<UserDocument[]> => {
  return (await userRepository.find({
    accountId: vehicle.accountId,
    role: "owner",
  })) as UserDocument[];
};

const toNotifiableAlerts = async (
  alerts: AlertDocument[],
): Promise<NotifiableAlert[]> => {
  const planItems = (await planItemRepository.find({
    _id: { $in: alerts.map((alert) => alert.planItemId) },
  })) as PlanItemDocument[];

  const nameById = new Map(
    planItems.map((item) => [String(item._id), item.name]),
  );

  return alerts.map((alert) => ({
    id: String(alert._id),
    milestone: alert.milestone,
    title: alert.title,
    message: alert.message,
    planItemId: String(alert.planItemId),
    itemName: nameById.get(String(alert.planItemId)) ?? alert.title,
  }));
};

const remindedRecently = async (
  vehicleId: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<boolean> => {
  const since = addDays(today(), -ODOMETER_REMINDER_INTERVAL_DAYS);

  const sent = await notificationRepository.count({
    vehicleId,
    userId,
    kind: "odometer_reminder",
    status: "sent",
    createdAt: { $gte: since },
  });

  return sent > 0;
};

const alreadyNotifiedToday = async (
  vehicleId: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<boolean> => {
  const sent = await notificationRepository.count({
    vehicleId,
    userId,
    status: "sent",
    createdAt: { $gte: today() },
  });

  return sent > 0;
};

const deliver = async (
  devices: PushDeviceDocument[],
  payload: unknown,
): Promise<{ delivered: boolean; deactivated: number; error?: string }> => {
  let delivered = false;
  let deactivated = 0;
  let error: string | undefined;

  for (const device of devices) {
    const result = await sendPush(
      { endpoint: device.endpoint, keys: device.keys },
      payload,
    );

    if (result.ok) {
      delivered = true;
      await pushDeviceRepository.updateOne(
        { _id: device._id },
        { $set: { lastSentAt: new Date() } },
      );
      continue;
    }

    error = result.error;

    if (result.gone) {
      deactivated += 1;
      await pushDeviceRepository.updateOne(
        { _id: device._id },
        { $set: { active: false } },
      );
    }
  }

  return { delivered, deactivated, error };
};

const persist = async (
  record: Record<string, unknown>,
  devices: PushDeviceDocument[],
  content: { title: string; body: string; deepLink: string },
  skipReason: string | null,
  vehicleId: string,
  result: SendNotificationsResult,
): Promise<void> => {
  if (skipReason) {
    await notificationRepository.insertOne({
      ...record,
      status: "skipped",
      skipReason,
    } as unknown as NotificationDocument);
    result.skipped += 1;
    return;
  }

  const delivery = await deliver(devices, { ...content, vehicleId });
  result.devicesDeactivated += delivery.deactivated;

  await notificationRepository.insertOne({
    ...record,
    status: delivery.delivered ? "sent" : "failed",
    sentAt: delivery.delivered ? new Date() : null,
    error: delivery.delivered ? null : (delivery.error ?? "push falhou"),
  } as unknown as NotificationDocument);

  if (delivery.delivered) result.sent += 1;
  else result.failed += 1;
};

const processReminder = async (
  message: NotificationJobMessage,
  vehicle: VehicleDocument,
  result: SendNotificationsResult,
): Promise<void> => {
  const recipients = await loadRecipients(vehicle);
  const content = buildOdometerReminderContent(
    vehicle.nickname,
    String(vehicle._id),
    message.daysSinceReading ?? 0,
  );

  for (const user of recipients) {
    const preferences = user.preferences ?? defaultPreferences();
    const devices = (await pushDeviceRepository.find({
      userId: user._id,
      active: true,
    })) as PushDeviceDocument[];

    const skipReason = decideOdometerReminder({
      preferences,
      hasActiveDevice: devices.length > 0,
      remindedRecently: await remindedRecently(
        vehicle._id as Types.ObjectId,
        user._id as Types.ObjectId,
      ),
      localTime: localTimeIn(preferences.timezone),
    });

    await persist(
      {
        accountId: vehicle.accountId,
        userId: user._id,
        vehicleId: vehicle._id,
        channel: "push" as const,
        kind: "odometer_reminder" as const,
        alertIds: [],
        ...content,
      },
      devices,
      content,
      skipReason,
      String(vehicle._id),
      result,
    );
  }
};

const processMessage = async (
  message: NotificationJobMessage,
  result: SendNotificationsResult,
): Promise<void> => {
  if (!Types.ObjectId.isValid(message.vehicleId)) return;

  const vehicle = (await vehicleRepository.findById(
    new Types.ObjectId(message.vehicleId),
  )) as VehicleDocument | null;

  if (!vehicle) return;

  if (message.kind === "odometer_reminder") {
    return processReminder(message, vehicle, result);
  }

  const alerts = (await alertRepository.find({
    _id: { $in: (message.alertIds ?? []).map((id) => new Types.ObjectId(id)) },
    status: "pending",
  })) as AlertDocument[];

  if (!alerts.length) return;

  const notifiable = await toNotifiableAlerts(alerts);
  const recipients = await loadRecipients(vehicle);

  for (const user of recipients) {
    const preferences = user.preferences ?? defaultPreferences();

    const devices = (await pushDeviceRepository.find({
      userId: user._id,
      active: true,
    })) as PushDeviceDocument[];

    const decision = decideNotification({
      preferences,
      alerts: notifiable,
      hasActiveDevice: devices.length > 0,
      alreadyNotifiedToday: await alreadyNotifiedToday(
        vehicle._id as Types.ObjectId,
        user._id as Types.ObjectId,
      ),
      localTime: localTimeIn(preferences.timezone),
    });

    const content = buildNotificationContent(
      vehicle.nickname,
      String(vehicle._id),
      decision.alerts,
    );

    await persist(
      {
        accountId: vehicle.accountId,
        userId: user._id,
        vehicleId: vehicle._id,
        channel: "push" as const,
        kind: "alert" as const,
        alertIds: decision.alerts.map((alert) => new Types.ObjectId(alert.id)),
        ...content,
      },
      devices,
      content,
      decision.skipReason,
      String(vehicle._id),
      result,
    );
  }
};

export const runSendNotifications = async (
  records: { body: string }[],
): Promise<SendNotificationsResult> => {
  const result: SendNotificationsResult = {
    received: records.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    devicesDeactivated: 0,
  };

  for (const record of records) {
    try {
      await processMessage(JSON.parse(record.body), result);
    } catch (error: any) {
      result.failed += 1;
      console.error("notification message failed", { message: error?.message });
    }
  }

  return result;
};
