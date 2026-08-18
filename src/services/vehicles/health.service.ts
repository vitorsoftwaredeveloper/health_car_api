import { buildItemMessage, compareByUrgency } from "../../domain/alerts";
import { healthBand } from "../../domain/health";
import { Requester } from "../../types/user";
import {
  StatusSummary,
} from "../plan/recalculate.service";
import { recalculateVehicle } from "../plan/recalculate.service";
import { assertVehicleAccess } from "./access.service";

export interface HealthItemView {
  id: string;
  code: string | null;
  custom: boolean;
  name: string;
  category: string;
  criticality: string;
  dueType: string;
  status: string;
  lastServiceDate: Date | null;
  lastServiceKm: number | null;
  nextDueDate: Date | null;
  nextDueKm: number | null;
  dueDate: Date | null;
  dueReason: string | null;
  daysRemaining: number | null;
  kmRemaining: number | null;
  muted: boolean;
  message: string;
}

export interface VehicleHealthView {
  vehicle: {
    id: string;
    nickname: string;
    estimatedOdometer: number;
    reportedOdometer: number;
    reportedOdometerAt: Date;
    kmPerDay: number;
    odometerConfidence: string;
    daysSinceReading: number;
  };
  healthScore: number;
  healthBand: string;
  summary: StatusSummary;
  items: HealthItemView[];
}

export const getVehicleHealth = async (
  requester: Requester,
  vehicleId: string,
): Promise<VehicleHealthView> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "read");
  const recalculation = await recalculateVehicle(vehicle);

  const items = recalculation.evaluations
    .filter(({ item }) => item.active)
    .sort((a, b) =>
      compareByUrgency(
        {
          status: a.item.status,
          dueDate: a.item.dueDate ?? null,
          criticality: a.item.criticality,
        },
        {
          status: b.item.status,
          dueDate: b.item.dueDate ?? null,
          criticality: b.item.criticality,
        },
      ),
    )
    .map(({ item, result }) => ({
      id: String(item._id),
      code: item.code ?? null,
      custom: item.custom,
      name: item.name,
      category: item.category,
      criticality: item.criticality,
      dueType: item.dueType,
      status: item.status,
      lastServiceDate: item.lastServiceDate ?? null,
      lastServiceKm: item.lastServiceKm ?? null,
      nextDueDate: result.nextDueDate,
      nextDueKm: result.nextDueKm,
      dueDate: result.dueDate,
      dueReason: result.dueReason,
      daysRemaining: result.daysRemaining,
      kmRemaining: result.kmRemaining,
      muted: item.muted,
      message: buildItemMessage({
        status: result.status,
        dueReason: result.dueReason,
        kmRemaining: result.kmRemaining,
        daysRemaining: result.daysRemaining,
      }),
    }));

  return {
    vehicle: {
      id: String(vehicle._id),
      nickname: vehicle.nickname,
      estimatedOdometer: recalculation.estimatedOdometer,
      reportedOdometer: recalculation.reportedOdometer,
      reportedOdometerAt: recalculation.reportedOdometerAt,
      kmPerDay: recalculation.kmPerDay,
      odometerConfidence: recalculation.odometerConfidence,
      daysSinceReading: recalculation.daysSinceReading,
    },
    healthScore: recalculation.healthScore,
    healthBand: healthBand(recalculation.healthScore),
    summary: recalculation.summary,
    items,
  };
};
