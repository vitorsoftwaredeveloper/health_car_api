import { defaultLeadTimeKm } from "./due";
import { DEFAULT_LEAD_TIME_DAYS } from "./constants";
import { CatalogItemDocument } from "../types/catalog";
import { Fuel, Transmission } from "../types/vehicle";
import { Criticality } from "../types/plan";

export interface VehicleFitment {
  fuel: Fuel;
  transmission?: Transmission | null;
}

export interface TemplateItemOverride {
  intervalKm?: number | null;
  intervalMonths?: number | null;
  activeByDefault?: boolean;
}

export interface PlanItemDraft {
  code: string;
  name: string;
  category: CatalogItemDocument["category"];
  dueType: CatalogItemDocument["dueType"];
  criticality: Criticality;
  intervalKm: number | null;
  intervalMonths: number | null;
  leadTimeDays: number;
  leadTimeKm: number;
  customized: boolean;
  custom: boolean;
  cycle: number;
  status: "unknown";
  active: boolean;
}

export const ACTIVE_BY_DEFAULT_CRITICALITIES: Criticality[] = [
  "critical",
  "high",
];

export const appliesToVehicle = (
  item: CatalogItemDocument,
  vehicle: VehicleFitment,
): boolean => {
  const fuels = item.appliesTo?.fuel;
  if (fuels?.length && !fuels.includes(vehicle.fuel)) return false;

  const transmissions = item.appliesTo?.transmission;
  if (transmissions?.length) {
    if (!vehicle.transmission) return false;
    if (!transmissions.includes(vehicle.transmission)) return false;
  }

  return true;
};

export const buildPlanItemDraft = (
  item: CatalogItemDocument,
  override: TemplateItemOverride = {},
): PlanItemDraft => {
  const intervalKm = override.intervalKm ?? item.defaultIntervalKm ?? null;
  const intervalMonths =
    override.intervalMonths ?? item.defaultIntervalMonths ?? null;

  return {
    code: item.code,
    name: item.name,
    category: item.category,
    dueType: item.dueType,
    criticality: item.criticality,
    intervalKm,
    intervalMonths,
    leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
    leadTimeKm: defaultLeadTimeKm(intervalKm),
    customized: false,
    custom: false,
    cycle: 0,
    status: "unknown",
    active:
      override.activeByDefault ??
      ACTIVE_BY_DEFAULT_CRITICALITIES.includes(item.criticality),
  };
};
