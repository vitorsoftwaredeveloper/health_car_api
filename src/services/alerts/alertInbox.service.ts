import { Types } from "mongoose";
import { estimateCurrentOdometer } from "../../domain/odometer";
import { alertRepository } from "../../repositories/alert.repository";
import { planItemRepository } from "../../repositories/planItem.repository";
import { vehicleRepository } from "../../repositories/vehicle.repository";
import { AlertDocument, AlertStatus } from "../../types/alert";
import { Requester } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { addDays, today } from "../../utils/date";
import { httpError, STATUS_CODE } from "../../utils/errors";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export interface ListAlertsQuery {
  status?: AlertStatus;
  vehicleId?: string;
  limit?: number;
  before?: string;
}

export interface SnoozeAlertPayload {
  days?: number;
  km?: number;
}

export interface AlertView {
  id: string;
  vehicleId: string;
  planItemId: string;
  cycle: number;
  milestone: string;
  severity: string;
  title: string;
  message: string;
  dueDate: Date | null;
  kmRemaining: number | null;
  daysRemaining: number | null;
  status: AlertStatus;
  readAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date | null;
}

const toAlertView = (alert: AlertDocument): AlertView => ({
  id: String(alert._id),
  vehicleId: String(alert.vehicleId),
  planItemId: String(alert.planItemId),
  cycle: alert.cycle,
  milestone: alert.milestone,
  severity: alert.severity,
  title: alert.title,
  message: alert.message,
  dueDate: alert.dueDate ?? null,
  kmRemaining: alert.kmRemaining ?? null,
  daysRemaining: alert.daysRemaining ?? null,
  status: alert.status,
  readAt: alert.readAt ?? null,
  snoozedUntil: alert.snoozedUntil ?? null,
  createdAt: alert.createdAt ?? null,
});

const alertNotFound = () =>
  httpError(STATUS_CODE.NOT_FOUND, "ALERT_NOT_FOUND", "Alerta não encontrado.");

const accessibleVehicleIds = async (
  requester: Requester,
): Promise<Types.ObjectId[]> => {
  const vehicles = (await vehicleRepository.find(
    {
      $or: [
        { accountId: requester.accountId },
        { "drivers.userId": requester.userId },
      ],
    },
    { _id: 1 },
  )) as VehicleDocument[];

  return vehicles.map((vehicle) => vehicle._id as Types.ObjectId);
};

export const loadAccessibleAlert = async (
  requester: Requester,
  alertId: string,
): Promise<AlertDocument> => {
  if (!Types.ObjectId.isValid(alertId)) throw alertNotFound();

  const alert = (await alertRepository.findOne({
    _id: new Types.ObjectId(alertId),
    accountId: requester.accountId,
  })) as AlertDocument | null;

  if (!alert) throw alertNotFound();

  if (requester.role === "driver") {
    const vehicleIds = await accessibleVehicleIds(requester);
    const allowed = vehicleIds.some(
      (id) => String(id) === String(alert.vehicleId),
    );
    if (!allowed) throw alertNotFound();
  }

  return alert;
};

export const listAlerts = async (
  requester: Requester,
  query: ListAlertsQuery,
): Promise<{ alerts: AlertView[]; nextCursor: string | null }> => {
  const limit = Math.min(query.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const filter: Record<string, unknown> = { accountId: requester.accountId };

  if (query.status) filter.status = query.status;

  if (query.vehicleId) {
    if (!Types.ObjectId.isValid(query.vehicleId)) {
      throw httpError(
        STATUS_CODE.NOT_FOUND,
        "VEHICLE_NOT_FOUND",
        "Veículo não encontrado.",
      );
    }
    filter.vehicleId = new Types.ObjectId(query.vehicleId);
  }

  if (requester.role === "driver") {
    const vehicleIds = await accessibleVehicleIds(requester);
    filter.vehicleId = query.vehicleId
      ? new Types.ObjectId(query.vehicleId)
      : { $in: vehicleIds };
  }

  if (query.before) filter.createdAt = { $lt: new Date(query.before) };

  const alerts = (await alertRepository.find(filter, null, {
    sort: { createdAt: -1 },
    limit: limit + 1,
  })) as AlertDocument[];

  const page = alerts.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    alerts.length > limit && last?.createdAt
      ? last.createdAt.toISOString()
      : null;

  return { alerts: page.map(toAlertView), nextCursor };
};

const updateAlert = async (
  alert: AlertDocument,
  update: Record<string, unknown>,
): Promise<AlertView> => {
  const updated = (await alertRepository.findOneAndUpdate(
    { _id: alert._id },
    { $set: update },
  )) as unknown as AlertDocument | null;

  if (!updated) throw alertNotFound();
  return toAlertView(updated);
};

export const markAlertAsRead = async (
  requester: Requester,
  alertId: string,
): Promise<AlertView> => {
  const alert = await loadAccessibleAlert(requester, alertId);

  if (alert.status !== "pending") return toAlertView(alert);

  return updateAlert(alert, { status: "read", readAt: new Date() });
};

export const dismissAlert = async (
  requester: Requester,
  alertId: string,
): Promise<AlertView> => {
  const alert = await loadAccessibleAlert(requester, alertId);

  if (alert.status === "resolved") {
    throw httpError(
      STATUS_CODE.CONFLICT,
      "ALERT_ALREADY_RESOLVED",
      "Este alerta já foi resolvido por um serviço registrado.",
    );
  }

  return updateAlert(alert, { status: "dismissed" });
};

export const snoozeAlert = async (
  requester: Requester,
  alertId: string,
  payload: SnoozeAlertPayload,
): Promise<AlertView> => {
  const alert = await loadAccessibleAlert(requester, alertId);

  if (alert.status === "resolved") {
    throw httpError(
      STATUS_CODE.CONFLICT,
      "ALERT_ALREADY_RESOLVED",
      "Este alerta já foi resolvido por um serviço registrado.",
    );
  }

  if (!payload.days && !payload.km) {
    throw httpError(
      STATUS_CODE.BAD_REQUEST,
      "SNOOZE_TARGET_REQUIRED",
      "Informe por quantos dias ou por quantos quilômetros adiar.",
    );
  }

  const snoozedUntil = payload.days ? addDays(today(), payload.days) : null;
  let snoozedUntilKm: number | null = null;

  if (payload.km) {
    const vehicle = (await vehicleRepository.findById(
      alert.vehicleId,
    )) as VehicleDocument | null;

    if (!vehicle) throw alertNotFound();

    snoozedUntilKm = estimateCurrentOdometer(vehicle, today()) + payload.km;
  }

  await planItemRepository.updateOne(
    { _id: alert.planItemId },
    {
      $set: {
        snoozedUntil,
        snoozedUntilKm,
      },
    },
  );

  return updateAlert(alert, { status: "snoozed", snoozedUntil });
};
