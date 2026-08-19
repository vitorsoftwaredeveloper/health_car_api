import { Types } from "mongoose";
import { defaultLeadTimeKm } from "../../domain/due";
import { DEFAULT_LEAD_TIME_DAYS } from "../../domain/constants";
import { planItemRepository } from "../../repositories/planItem.repository";
import { Category } from "../../types/catalog";
import { Criticality, DueType } from "../../types/plan";
import { PlanItemDocument } from "../../types/plan-item";
import { Requester } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { parseLocalDate, today } from "../../utils/date";
import { httpError, STATUS_CODE } from "../../utils/errors";
import { recalculateVehicle } from "./recalculate.service";
import { assertVehicleAccess } from "../vehicles/access.service";
import { PlanItemView, toPlanItemView } from "./plan.service";

export interface UpdatePlanItemPayload {
  intervalKm?: number | null;
  intervalMonths?: number | null;
  lastServiceKm?: number | null;
  lastServiceDate?: string | null;
  leadTimeDays?: number;
  leadTimeKm?: number;
  note?: string | null;
  active?: boolean;
}

export interface MutePlanItemPayload {
  muted: boolean;
}

export interface CreateCustomItemPayload {
  name: string;
  category: Category;
  dueType: DueType;
  intervalKm?: number | null;
  intervalMonths?: number | null;
  criticality?: Criticality;
  lastServiceKm?: number | null;
  lastServiceDate?: string | null;
  note?: string | null;
}

export interface PlanItemResult {
  item: PlanItemView;
  healthScore: number;
}

const itemNotFound = () =>
  httpError(
    STATUS_CODE.NOT_FOUND,
    "PLAN_ITEM_NOT_FOUND",
    "Item do plano não encontrado.",
  );

const assertIntervalsMatchDueType = (
  dueType: DueType,
  intervalKm?: number | null,
  intervalMonths?: number | null,
): void => {
  if ((dueType === "km" || dueType === "both") && !intervalKm) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "INTERVAL_KM_REQUIRED",
      "Item que vence por quilometragem precisa de intervalo em km.",
    );
  }

  if ((dueType === "time" || dueType === "both") && !intervalMonths) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "INTERVAL_MONTHS_REQUIRED",
      "Item que vence por tempo precisa de intervalo em meses.",
    );
  }

  if (dueType === "inspection" && !intervalKm && !intervalMonths) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "INSPECTION_INTERVAL_REQUIRED",
      "Item de inspeção precisa de um intervalo de verificação.",
    );
  }
};

const loadPlanItem = async (
  vehicle: VehicleDocument,
  planItemId: string,
): Promise<PlanItemDocument> => {
  if (!Types.ObjectId.isValid(planItemId)) throw itemNotFound();

  const item = (await planItemRepository.findOne({
    _id: new Types.ObjectId(planItemId),
    vehicleId: vehicle._id,
  })) as PlanItemDocument | null;

  if (!item) throw itemNotFound();
  return item;
};

const withRecalculation = async (
  vehicle: VehicleDocument,
  planItemId: Types.ObjectId,
): Promise<PlanItemResult> => {
  const recalculation = await recalculateVehicle(vehicle);
  const item = recalculation.items.find(
    (candidate) => String(candidate._id) === String(planItemId),
  );

  if (!item) throw itemNotFound();

  return { item: toPlanItemView(item), healthScore: recalculation.healthScore };
};

export const updatePlanItem = async (
  requester: Requester,
  vehicleId: string,
  planItemId: string,
  payload: UpdatePlanItemPayload,
): Promise<PlanItemResult> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");
  const item = await loadPlanItem(vehicle, planItemId);

  const intervalKm =
    payload.intervalKm !== undefined ? payload.intervalKm : item.intervalKm;
  const intervalMonths =
    payload.intervalMonths !== undefined
      ? payload.intervalMonths
      : item.intervalMonths;

  assertIntervalsMatchDueType(item.dueType, intervalKm, intervalMonths);

  const update: Record<string, unknown> = {
    intervalKm: intervalKm ?? null,
    intervalMonths: intervalMonths ?? null,
    customized: true,
  };

  if (payload.leadTimeDays !== undefined) {
    update.leadTimeDays = payload.leadTimeDays;
  }
  if (payload.leadTimeKm !== undefined) update.leadTimeKm = payload.leadTimeKm;
  if (payload.note !== undefined) update.note = payload.note;
  if (payload.active !== undefined) update.active = payload.active;

  if (payload.lastServiceKm !== undefined) {
    update.lastServiceKm = payload.lastServiceKm;
  }
  if (payload.lastServiceDate !== undefined) {
    update.lastServiceDate = payload.lastServiceDate
      ? parseLocalDate(payload.lastServiceDate)
      : null;
  }

  await planItemRepository.updateOne({ _id: item._id }, { $set: update });

  return withRecalculation(vehicle, item._id as Types.ObjectId);
};

export const mutePlanItem = async (
  requester: Requester,
  vehicleId: string,
  planItemId: string,
  payload: MutePlanItemPayload,
): Promise<PlanItemResult> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");
  const item = await loadPlanItem(vehicle, planItemId);

  await planItemRepository.updateOne(
    { _id: item._id },
    { $set: { muted: payload.muted } },
  );

  return withRecalculation(vehicle, item._id as Types.ObjectId);
};

export const deactivatePlanItem = async (
  requester: Requester,
  vehicleId: string,
  planItemId: string,
): Promise<PlanItemResult> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");
  const item = await loadPlanItem(vehicle, planItemId);

  await planItemRepository.updateOne(
    { _id: item._id },
    { $set: { active: false } },
  );

  return withRecalculation(vehicle, item._id as Types.ObjectId);
};

export const createCustomPlanItem = async (
  requester: Requester,
  vehicleId: string,
  payload: CreateCustomItemPayload,
): Promise<PlanItemResult & { duplicateName: boolean }> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");

  assertIntervalsMatchDueType(
    payload.dueType,
    payload.intervalKm,
    payload.intervalMonths,
  );

  const name = payload.name.trim();
  const duplicate = await planItemRepository.findOne({
    vehicleId: vehicle._id,
    name,
  });

  const planItemId = new Types.ObjectId();

  await planItemRepository.insertOne({
    _id: planItemId,
    accountId: vehicle.accountId,
    vehicleId: vehicle._id,
    catalogItemId: null,
    code: null,
    custom: true,
    name,
    category: payload.category,
    dueType: payload.dueType,
    intervalKm: payload.intervalKm ?? null,
    intervalMonths: payload.intervalMonths ?? null,
    criticality: payload.criticality ?? "medium",
    customized: true,
    lastServiceKm: payload.lastServiceKm ?? null,
    lastServiceDate: payload.lastServiceDate
      ? parseLocalDate(payload.lastServiceDate)
      : null,
    cycle: 0,
    status: "unknown",
    leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
    leadTimeKm: defaultLeadTimeKm(payload.intervalKm),
    muted: false,
    active: true,
    note: payload.note ?? null,
    calculatedAt: today(),
  } as PlanItemDocument);

  return {
    ...(await withRecalculation(vehicle, planItemId)),
    duplicateName: !!duplicate,
  };
};
