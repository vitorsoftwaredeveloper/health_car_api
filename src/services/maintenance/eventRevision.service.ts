import { ClientSession, Types } from "mongoose";
import { computeEventTotalCents } from "../../domain/money";
import { withTransaction } from "../../libs/mongo";
import { alertRepository } from "../../repositories/alert.repository";
import { attachmentRepository } from "../../repositories/attachment.repository";
import { maintenanceEventRepository } from "../../repositories/maintenanceEvent.repository";
import { odometerReadingRepository } from "../../repositories/odometerReading.repository";
import { planItemRepository } from "../../repositories/planItem.repository";
import {
  EventItem,
  MaintenanceEventDocument,
} from "../../types/maintenance";
import { PlanItemDocument } from "../../types/plan-item";
import { Requester } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { parseLocalDate, today } from "../../utils/date";
import { httpError, STATUS_CODE } from "../../utils/errors";
import { recalculateVehicle } from "../plan/recalculate.service";
import { assertVehicleAccess } from "../vehicles/access.service";
import {
  linkAttachments,
  MaintenanceEventView,
  RegisterMaintenancePayload,
  toMaintenanceEventView,
} from "./maintenance.service";

export interface RestatedPlanItem {
  id: string;
  code: string | null;
  name: string;
  status: string;
  cycle: number;
  lastServiceKm: number | null;
  lastServiceDate: Date | null;
}

export interface EventRevisionResult {
  event: MaintenanceEventView | null;
  restatedItems: RestatedPlanItem[];
  healthScore: number;
}

const eventNotFound = () =>
  httpError(
    STATUS_CODE.NOT_FOUND,
    "MAINTENANCE_EVENT_NOT_FOUND",
    "Serviço não encontrado.",
  );

const loadEvent = async (
  vehicle: VehicleDocument,
  eventId: string,
): Promise<MaintenanceEventDocument> => {
  if (!Types.ObjectId.isValid(eventId)) throw eventNotFound();

  const event = (await maintenanceEventRepository.findOne({
    _id: new Types.ObjectId(eventId),
    vehicleId: vehicle._id,
  })) as MaintenanceEventDocument | null;

  if (!event) throw eventNotFound();
  return event;
};

const servicedPlanItemIds = (event: MaintenanceEventDocument): string[] =>
  (event.items ?? [])
    .filter((item) => item.action === "replace" && item.planItemId)
    .map((item) => String(item.planItemId));

export const restatePlanItems = async (
  vehicle: VehicleDocument,
  planItemIds: string[],
  session: ClientSession,
): Promise<void> => {
  for (const planItemId of planItemIds) {
    const objectId = new Types.ObjectId(planItemId);

    const [latest] = (await maintenanceEventRepository.find(
      {
        vehicleId: vehicle._id,
        items: { $elemMatch: { planItemId: objectId, action: "replace" } },
      },
      null,
      { sort: { date: -1, createdAt: -1 }, limit: 1, session },
    )) as MaintenanceEventDocument[];

    await planItemRepository.updateOne(
      { _id: objectId },
      {
        $set: {
          lastServiceKm: latest ? latest.km : null,
          lastServiceDate: latest ? latest.date : null,
          lastServiceEventId: latest ? latest._id : null,
        },
      },
      { session },
    );
  }
};

const restatedView = async (
  vehicle: VehicleDocument,
  planItemIds: string[],
  session: ClientSession,
): Promise<{ items: RestatedPlanItem[]; healthScore: number }> => {
  const recalculation = await recalculateVehicle(vehicle, session);
  const wanted = new Set(planItemIds);

  return {
    items: recalculation.items
      .filter((item) => wanted.has(String(item._id)))
      .map((item: PlanItemDocument) => ({
        id: String(item._id),
        code: item.code ?? null,
        name: item.name,
        status: item.status,
        cycle: item.cycle,
        lastServiceKm: item.lastServiceKm ?? null,
        lastServiceDate: item.lastServiceDate ?? null,
      })),
    healthScore: recalculation.healthScore,
  };
};

export const reverseMaintenanceEvent = async (
  requester: Requester,
  vehicleId: string,
  eventId: string,
): Promise<EventRevisionResult> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");
  const event = await loadEvent(vehicle, eventId);
  const affected = servicedPlanItemIds(event);

  return withTransaction(async (session) => {
    await maintenanceEventRepository.deleteOne({ _id: event._id }, { session });

    await odometerReadingRepository.deleteMany(
      { vehicleId: vehicle._id, referenceId: event._id, source: "service" },
      { session },
    );

    await attachmentRepository.updateMany(
      { "link.documentId": event._id },
      { $set: { link: null } },
      { session },
    );

    await alertRepository.updateMany(
      { resolvedByEventId: event._id },
      { $set: { resolvedByEventId: null } },
      { session },
    );

    await restatePlanItems(vehicle, affected, session);
    const { items, healthScore } = await restatedView(vehicle, affected, session);

    return { event: null, restatedItems: items, healthScore };
  });
};

export const updateMaintenanceEvent = async (
  requester: Requester,
  vehicleId: string,
  eventId: string,
  payload: RegisterMaintenancePayload,
): Promise<EventRevisionResult> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "write");
  const event = await loadEvent(vehicle, eventId);

  const date = payload.date ? parseLocalDate(payload.date) : event.date;

  if (date.getTime() > today().getTime()) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "FUTURE_DATE",
      "A data do serviço não pode estar no futuro.",
    );
  }

  const referencedIds = payload.items
    .map((item) => item.planItemId)
    .filter((id): id is string => !!id);

  if (referencedIds.some((id) => !Types.ObjectId.isValid(id))) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "PLAN_ITEM_NOT_FOUND",
      "Item do plano não encontrado.",
    );
  }

  const planItems = (await planItemRepository.find({
    _id: { $in: referencedIds.map((id) => new Types.ObjectId(id)) },
    vehicleId: vehicle._id,
  })) as PlanItemDocument[];

  if (planItems.length !== new Set(referencedIds).size) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "PLAN_ITEM_NOT_FOUND",
      "Item do plano não encontrado neste veículo.",
    );
  }

  const byId = new Map(planItems.map((item) => [String(item._id), item]));

  const items: EventItem[] = payload.items.map((item) => {
    const planItem = item.planItemId ? byId.get(item.planItemId) : undefined;

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

  const affected = [
    ...new Set([
      ...servicedPlanItemIds(event),
      ...items
        .filter((item) => item.action === "replace" && item.planItemId)
        .map((item) => String(item.planItemId)),
    ]),
  ];

  return withTransaction(async (session) => {
    const attachments = payload.attachmentIds
      ? await linkAttachments(
          vehicle,
          payload.attachmentIds,
          event._id as Types.ObjectId,
          session,
        )
      : (event.attachments ?? []);

    const detached = (event.attachments ?? [])
      .filter(
        (attachment) =>
          !attachments.some(
            (kept) => String(kept.attachmentId) === String(attachment.attachmentId),
          ),
      )
      .map((attachment) => attachment.attachmentId);

    if (detached.length) {
      await attachmentRepository.updateMany(
        { _id: { $in: detached } },
        { $set: { link: null } },
        { session },
      );
    }

    const updated = (await maintenanceEventRepository.findOneAndUpdate(
      { _id: event._id },
      {
        $set: {
          date,
          km: payload.km,
          type: payload.type ?? event.type,
          workshop: payload.workshop ?? event.workshop ?? null,
          items,
          attachments,
          laborCents: payload.laborCents ?? null,
          totalCents: computeEventTotalCents(items, payload.laborCents),
          note: payload.note ?? null,
        },
      },
      { session },
    )) as unknown as MaintenanceEventDocument | null;

    if (!updated) throw eventNotFound();

    await odometerReadingRepository.updateMany(
      { vehicleId: vehicle._id, referenceId: event._id, source: "service" },
      { $set: { km: payload.km, date } },
      { session },
    );

    await restatePlanItems(vehicle, affected, session);
    const { items: restated, healthScore } = await restatedView(
      vehicle,
      affected,
      session,
    );

    return {
      event: toMaintenanceEventView(updated),
      restatedItems: restated,
      healthScore,
    };
  });
};
