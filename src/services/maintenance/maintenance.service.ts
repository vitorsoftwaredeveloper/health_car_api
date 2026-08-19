import { ClientSession, Types } from "mongoose";
import { computeEventTotalCents } from "../../domain/money";
import { withTransaction } from "../../libs/mongo";
import { alertRepository } from "../../repositories/alert.repository";
import { attachmentRepository } from "../../repositories/attachment.repository";
import { maintenanceEventRepository } from "../../repositories/maintenanceEvent.repository";
import { odometerReadingRepository } from "../../repositories/odometerReading.repository";
import { planItemRepository } from "../../repositories/planItem.repository";
import { AttachmentDocument } from "../../types/maintenance";
import {
  EventItem,
  EventItemAction,
  MaintenanceEventDocument,
  MaintenanceSource,
  MaintenanceType,
  Workshop,
} from "../../types/maintenance";
import { ItemStatus } from "../../types/plan";
import { PlanItemDocument } from "../../types/plan-item";
import { Requester } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { parseLocalDate, today } from "../../utils/date";
import { httpError, STATUS_CODE } from "../../utils/errors";
import { recalculateVehicle } from "../plan/recalculate.service";
import { assertVehicleAccess } from "../vehicles/access.service";

const OPEN_ALERT_STATUSES = ["pending", "read", "snoozed"];

export interface MaintenanceItemPayload {
  planItemId?: string | null;
  description: string;
  action: EventItemAction;
  partBrand?: string | null;
  partCents?: number | null;
  laborCents?: number | null;
}

export interface RegisterMaintenancePayload {
  date?: string;
  km: number;
  type?: MaintenanceType;
  workshop?: Workshop | null;
  items: MaintenanceItemPayload[];
  laborCents?: number | null;
  note?: string | null;
  attachmentIds?: string[];
}

export interface UpdatedPlanItemView {
  id: string;
  code: string | null;
  name: string;
  previousStatus: ItemStatus;
  status: ItemStatus;
  nextDueKm: number | null;
  nextDueDate: Date | null;
  cycle: number;
}

export interface MaintenanceEventView {
  id: string;
  date: Date;
  km: number;
  type: MaintenanceType;
  workshop: Workshop | null;
  items: {
    planItemId: string | null;
    code: string | null;
    description: string;
    action: EventItemAction;
    partBrand: string | null;
    partCents: number | null;
    laborCents: number | null;
  }[];
  laborCents: number | null;
  totalCents: number;
  note: string | null;
  attachments: { attachmentId: string; type: string; fileName: string }[];
  source: MaintenanceSource;
  createdAt: Date | null;
}

export interface RegisterMaintenanceResult {
  event: MaintenanceEventView;
  updatedItems: UpdatedPlanItemView[];
  closedAlerts: number;
  healthScore: number;
}

export const toMaintenanceEventView = (
  event: MaintenanceEventDocument,
): MaintenanceEventView => ({
  id: String(event._id),
  date: event.date,
  km: event.km,
  type: event.type,
  workshop: event.workshop ?? null,
  items: (event.items ?? []).map((item) => ({
    planItemId: item.planItemId ? String(item.planItemId) : null,
    code: item.code ?? null,
    description: item.description,
    action: item.action,
    partBrand: item.partBrand ?? null,
    partCents: item.partCents ?? null,
    laborCents: item.laborCents ?? null,
  })),
  laborCents: event.laborCents ?? null,
  totalCents: event.totalCents,
  note: event.note ?? null,
  attachments: (event.attachments ?? []).map((attachment) => ({
    attachmentId: String(attachment.attachmentId),
    type: attachment.type,
    fileName: attachment.fileName,
  })),
  source: event.source,
  createdAt: event.createdAt ?? null,
});

const assertNotInFuture = (date: Date): void => {
  if (date.getTime() > today().getTime()) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "FUTURE_DATE",
      "A data do serviço não pode estar no futuro.",
    );
  }
};

const assertKmIsCoherent = async (
  vehicle: VehicleDocument,
  km: number,
  date: Date,
): Promise<void> => {
  const [previous] = (await odometerReadingRepository.find(
    { vehicleId: vehicle._id, date: { $lte: date } },
    null,
    { sort: { date: -1 }, limit: 1 },
  )) as { km: number }[];

  if (previous && km < previous.km) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "ODOMETER_REGRESSION",
      `A quilometragem do serviço é menor que a leitura de ${previous.km} km registrada até esta data.`,
    );
  }
};

const loadPlanItems = async (
  vehicle: VehicleDocument,
  payload: RegisterMaintenancePayload,
): Promise<Map<string, PlanItemDocument>> => {
  const ids = payload.items
    .map((item) => item.planItemId)
    .filter((id): id is string => !!id);

  if (!ids.length) return new Map();

  if (ids.some((id) => !Types.ObjectId.isValid(id))) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "PLAN_ITEM_NOT_FOUND",
      "Item do plano não encontrado.",
    );
  }

  const items = (await planItemRepository.find({
    _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
    vehicleId: vehicle._id,
  })) as PlanItemDocument[];

  if (items.length !== new Set(ids).size) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "PLAN_ITEM_NOT_FOUND",
      "Item do plano não encontrado neste veículo.",
    );
  }

  return new Map(items.map((item) => [String(item._id), item]));
};

const linkAttachments = async (
  vehicle: VehicleDocument,
  attachmentIds: string[],
  eventId: Types.ObjectId,
  session: ClientSession,
): Promise<MaintenanceEventDocument["attachments"]> => {
  if (!attachmentIds.length) return [];

  if (attachmentIds.some((id) => !Types.ObjectId.isValid(id))) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "ATTACHMENT_NOT_FOUND",
      "Anexo não encontrado.",
    );
  }

  const objectIds = attachmentIds.map((id) => new Types.ObjectId(id));
  const attachments = (await attachmentRepository.find({
    _id: { $in: objectIds },
    vehicleId: vehicle._id,
  })) as AttachmentDocument[];

  if (attachments.length !== new Set(attachmentIds).size) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "ATTACHMENT_NOT_FOUND",
      "Anexo não encontrado neste veículo.",
    );
  }

  await attachmentRepository.updateMany(
    { _id: { $in: objectIds } },
    { $set: { link: { collection: "maintenanceEvents", documentId: eventId } } },
    { session },
  );

  return attachments.map((attachment) => ({
    attachmentId: attachment._id as Types.ObjectId,
    type: attachment.type,
    fileName: attachment.fileName,
  }));
};

export const registerMaintenanceEvent = async (
  requester: Requester,
  vehicleId: string,
  payload: RegisterMaintenancePayload,
  source: MaintenanceSource = "manual",
): Promise<RegisterMaintenanceResult> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "write");
  const date = payload.date ? parseLocalDate(payload.date) : today();

  assertNotInFuture(date);
  await assertKmIsCoherent(vehicle, payload.km, date);

  const planItems = await loadPlanItems(vehicle, payload);
  const eventId = new Types.ObjectId();

  return withTransaction(async (session) => {
    const items: EventItem[] = payload.items.map((item) => {
      const planItem = item.planItemId
        ? planItems.get(item.planItemId)
        : undefined;

      return {
        planItemId: planItem?._id ?? null,
        code: planItem?.code ?? null,
        description: item.description.trim(),
        action: item.action,
        partBrand: item.partBrand ?? null,
        partCents: item.partCents ?? null,
        laborCents: item.laborCents ?? null,
      };
    });

    const attachments = await linkAttachments(
      vehicle,
      payload.attachmentIds ?? [],
      eventId,
      session,
    );

    const created = await maintenanceEventRepository.insertOne(
      {
        _id: eventId,
        accountId: vehicle.accountId,
        vehicleId: vehicle._id,
        date,
        km: payload.km,
        type: payload.type ?? "preventive",
        workshop: payload.workshop ?? null,
        items,
        laborCents: payload.laborCents ?? null,
        totalCents: computeEventTotalCents(items, payload.laborCents),
        note: payload.note ?? null,
        attachments,
        source,
        createdBy: requester.userId,
      },
      { session },
    );

    await odometerReadingRepository.insertOne(
      {
        accountId: vehicle.accountId,
        vehicleId: vehicle._id,
        km: payload.km,
        date,
        source: "service",
        referenceId: eventId,
        createdBy: requester.userId,
      },
      { session },
    );

    const servicedItems = items.filter(
      (item) => item.action === "replace" && item.planItemId,
    );

    const previousStatusById = new Map<string, ItemStatus>();
    let closedAlerts = 0;

    for (const item of servicedItems) {
      const planItem = planItems.get(String(item.planItemId)) as PlanItemDocument;
      previousStatusById.set(String(planItem._id), planItem.status);

      await planItemRepository.updateOne(
        { _id: planItem._id },
        {
          $set: {
            lastServiceKm: payload.km,
            lastServiceDate: date,
            lastServiceEventId: eventId,
            snoozedUntil: null,
            snoozedUntilKm: null,
          },
          $inc: { cycle: 1 },
        },
        { session },
      );

      const closed = await alertRepository.updateMany(
        {
          planItemId: planItem._id,
          cycle: { $lte: planItem.cycle },
          status: { $in: OPEN_ALERT_STATUSES },
        },
        {
          $set: {
            status: "resolved",
            resolvedAt: new Date(),
            resolvedByEventId: eventId,
          },
        },
        { session },
      );

      closedAlerts += closed.modifiedCount ?? 0;
    }

    const recalculation = await recalculateVehicle(vehicle, session);

    const updatedItems: UpdatedPlanItemView[] = recalculation.items
      .filter((item) => previousStatusById.has(String(item._id)))
      .map((item) => ({
        id: String(item._id),
        code: item.code ?? null,
        name: item.name,
        previousStatus: previousStatusById.get(String(item._id)) as ItemStatus,
        status: item.status,
        nextDueKm: item.nextDueKm ?? null,
        nextDueDate: item.nextDueDate ?? null,
        cycle: item.cycle,
      }));

    return {
      event: toMaintenanceEventView(
        created.toObject() as MaintenanceEventDocument,
      ),
      updatedItems,
      closedAlerts,
      healthScore: recalculation.healthScore,
    };
  });
};
