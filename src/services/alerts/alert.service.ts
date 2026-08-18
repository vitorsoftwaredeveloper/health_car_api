import { Types } from "mongoose";
import {
  buildAlertTitle,
  buildItemMessage,
  milestoneSeverity,
  resolveMilestone,
} from "../../domain/alerts";
import { isAlertSuppressed } from "../../domain/due";
import { alertRepository } from "../../repositories/alert.repository";
import { AlertDocument } from "../../types/alert";
import { VehicleDocument } from "../../types/vehicle";
import { daysBetween, today } from "../../utils/date";
import { DUPLICATE_KEY_ERROR_CODE } from "../../utils/errors";
import { RecalculationResult } from "../plan/recalculate.service";

export interface AlertSyncResult {
  created: AlertDocument[];
  duplicates: number;
}

const buildAlert = (
  vehicle: VehicleDocument,
  evaluation: RecalculationResult["evaluations"][number],
  milestone: string,
  reference: Date,
): AlertDocument => {
  const { item, result } = evaluation;

  return {
    accountId: vehicle.accountId,
    vehicleId: vehicle._id as Types.ObjectId,
    planItemId: item._id as Types.ObjectId,
    cycle: item.cycle,
    milestone,
    severity: milestoneSeverity(milestone, item.criticality),
    title: buildAlertTitle(item.name, milestone),
    message: buildItemMessage({
      status: result.status,
      dueReason: result.dueReason,
      kmRemaining: result.kmRemaining,
      daysRemaining: result.daysRemaining,
    }),
    dueDate: result.dueDate,
    kmRemaining: result.kmRemaining,
    daysRemaining: result.dueDate
      ? daysBetween(result.dueDate, reference)
      : null,
    status: "pending",
  } as AlertDocument;
};

export const syncAlertsForVehicle = async (
  vehicle: VehicleDocument,
  recalculation: RecalculationResult,
): Promise<AlertSyncResult> => {
  const reference = today();
  const context = {
    today: reference,
    estimatedOdometer: recalculation.estimatedOdometer,
    kmPerDay: recalculation.kmPerDay,
  };

  const created: AlertDocument[] = [];
  let duplicates = 0;

  for (const evaluation of recalculation.evaluations) {
    const { item, result } = evaluation;

    if (!item.active) continue;
    if (result.status === "unknown") continue;
    if (isAlertSuppressed(item, context)) continue;
    if (!result.dueDate) continue;

    const milestone = resolveMilestone(daysBetween(result.dueDate, reference));
    if (!milestone) continue;

    try {
      const alert = await alertRepository.insertOne(
        buildAlert(vehicle, evaluation, milestone, reference),
      );
      created.push(alert.toObject() as AlertDocument);
    } catch (error: any) {
      if (error?.code !== DUPLICATE_KEY_ERROR_CODE) throw error;
      duplicates += 1;
    }
  }

  return { created, duplicates };
};
