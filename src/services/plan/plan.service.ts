import { ClientSession, Types } from "mongoose";
import { buildPlanItemDraft, appliesToVehicle } from "../../domain/planItem";
import { selectTemplate } from "../../domain/planTemplate";
import { catalogItemRepository } from "../../repositories/catalogItem.repository";
import { planItemRepository } from "../../repositories/planItem.repository";
import { planTemplateRepository } from "../../repositories/planTemplate.repository";
import { CatalogItemDocument } from "../../types/catalog";
import { PlanItemDocument } from "../../types/plan-item";
import { PlanTemplateDocument, PlanTemplateItem } from "../../types/plan-template";
import { Requester } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { parseLocalDate } from "../../utils/date";
import { httpError, STATUS_CODE } from "../../utils/errors";
import { assertVehicleAccess } from "../vehicles/access.service";

export interface AddPlanItemPayload {
  catalogItemCode: string;
  intervalKm?: number | null;
  intervalMonths?: number | null;
  lastServiceKm?: number | null;
  lastServiceDate?: string | null;
  active?: boolean;
}

export interface ApplyTemplateResult {
  templateName: string | null;
  created: number;
  skipped: number;
}

export interface PlanItemView {
  id: string;
  code: string | null;
  custom: boolean;
  name: string;
  category: string;
  dueType: string;
  criticality: string;
  intervalKm: number | null;
  intervalMonths: number | null;
  customized: boolean;
  lastServiceKm: number | null;
  lastServiceDate: Date | null;
  cycle: number;
  nextDueKm: number | null;
  nextDueDate: Date | null;
  dueDate: Date | null;
  dueReason: string | null;
  status: string;
  leadTimeDays: number;
  leadTimeKm: number;
  muted: boolean;
  active: boolean;
  note: string | null;
}

export const toPlanItemView = (item: PlanItemDocument): PlanItemView => ({
  id: String(item._id),
  code: item.code ?? null,
  custom: item.custom,
  name: item.name,
  category: item.category,
  dueType: item.dueType,
  criticality: item.criticality,
  intervalKm: item.intervalKm ?? null,
  intervalMonths: item.intervalMonths ?? null,
  customized: item.customized,
  lastServiceKm: item.lastServiceKm ?? null,
  lastServiceDate: item.lastServiceDate ?? null,
  cycle: item.cycle,
  nextDueKm: item.nextDueKm ?? null,
  nextDueDate: item.nextDueDate ?? null,
  dueDate: item.dueDate ?? null,
  dueReason: item.dueReason ?? null,
  status: item.status,
  leadTimeDays: item.leadTimeDays,
  leadTimeKm: item.leadTimeKm,
  muted: item.muted,
  active: item.active,
  note: item.note ?? null,
});

const loadTemplateForVehicle = async (
  vehicle: VehicleDocument,
): Promise<PlanTemplateDocument | null> => {
  const templates = (await planTemplateRepository.find({
    active: true,
  })) as PlanTemplateDocument[];

  return selectTemplate(templates, {
    fuel: vehicle.fuel,
    transmission: vehicle.transmission,
    modelYear: vehicle.modelYear,
  });
};

const toDocument = (
  vehicle: VehicleDocument,
  catalogItem: CatalogItemDocument,
  override: Partial<PlanTemplateItem>,
): PlanItemDocument => {
  const draft = buildPlanItemDraft(catalogItem, {
    intervalKm: override.intervalKm,
    intervalMonths: override.intervalMonths,
    activeByDefault: override.activeByDefault,
  });

  return {
    ...draft,
    _id: new Types.ObjectId(),
    accountId: vehicle.accountId,
    vehicleId: vehicle._id as Types.ObjectId,
    catalogItemId: catalogItem._id as Types.ObjectId,
    muted: false,
    calculatedAt: new Date(),
  } as PlanItemDocument;
};

export const applyTemplateToVehicle = async (
  vehicle: VehicleDocument,
  session?: ClientSession,
): Promise<ApplyTemplateResult> => {
  const template = await loadTemplateForVehicle(vehicle);
  if (!template) return { templateName: null, created: 0, skipped: 0 };

  const codes = template.items.map((item) => item.catalogItemCode);
  const catalogItems = (await catalogItemRepository.find({
    code: { $in: codes },
    active: true,
  })) as CatalogItemDocument[];

  const existing = (await planItemRepository.find(
    { vehicleId: vehicle._id, catalogItemId: { $ne: null } },
    { catalogItemId: 1 },
  )) as PlanItemDocument[];

  const alreadyInPlan = new Set(
    existing.map((item) => String(item.catalogItemId)),
  );
  const overrideByCode = new Map(
    template.items.map((item) => [item.catalogItemCode, item]),
  );

  const documents: PlanItemDocument[] = [];
  let skipped = 0;

  for (const catalogItem of catalogItems) {
    if (alreadyInPlan.has(String(catalogItem._id))) {
      skipped += 1;
      continue;
    }

    if (!appliesToVehicle(catalogItem, vehicle)) {
      skipped += 1;
      continue;
    }

    documents.push(
      toDocument(vehicle, catalogItem, overrideByCode.get(catalogItem.code) ?? {}),
    );
  }

  if (documents.length) {
    await planItemRepository.insertMany(
      documents,
      session ? { session } : undefined,
    );
  }

  return {
    templateName: template.name,
    created: documents.length,
    skipped,
  };
};

export const getPlan = async (
  requester: Requester,
  vehicleId: string,
): Promise<PlanItemView[]> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "read");

  const items = (await planItemRepository.find({ vehicleId: vehicle._id }, null, {
    sort: { category: 1, name: 1 },
  })) as PlanItemDocument[];

  return items.map(toPlanItemView);
};

export const applyTemplate = async (
  requester: Requester,
  vehicleId: string,
): Promise<ApplyTemplateResult> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");
  return applyTemplateToVehicle(vehicle);
};

export const addCatalogItemToPlan = async (
  requester: Requester,
  vehicleId: string,
  payload: AddPlanItemPayload,
): Promise<PlanItemView> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");

  const catalogItem = (await catalogItemRepository.findOne({
    code: payload.catalogItemCode.trim().toUpperCase(),
    active: true,
  })) as CatalogItemDocument | null;

  if (!catalogItem) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "CATALOG_ITEM_NOT_FOUND",
      "Item de catálogo não encontrado.",
    );
  }

  const duplicate = await planItemRepository.findOne({
    vehicleId: vehicle._id,
    catalogItemId: catalogItem._id,
  });

  if (duplicate) {
    throw httpError(
      STATUS_CODE.CONFLICT,
      "PLAN_ITEM_ALREADY_EXISTS",
      "Este item já faz parte do plano do veículo.",
    );
  }

  const document = toDocument(vehicle, catalogItem, {
    intervalKm: payload.intervalKm ?? undefined,
    intervalMonths: payload.intervalMonths ?? undefined,
    activeByDefault: payload.active ?? true,
  });

  const customized =
    (payload.intervalKm != null &&
      payload.intervalKm !== catalogItem.defaultIntervalKm) ||
    (payload.intervalMonths != null &&
      payload.intervalMonths !== catalogItem.defaultIntervalMonths);

  const created = await planItemRepository.insertOne({
    ...document,
    customized,
    lastServiceKm: payload.lastServiceKm ?? null,
    lastServiceDate: payload.lastServiceDate
      ? parseLocalDate(payload.lastServiceDate)
      : null,
  });

  return toPlanItemView(created.toObject() as PlanItemDocument);
};
