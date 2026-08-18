import { ClientSession, Types } from "mongoose";
import { computeItemStatus } from "../../domain/due";
import { computeHealthScore } from "../../domain/health";
import {
  computeKmPerDay,
  estimateCurrentOdometer,
  odometerConfidence,
} from "../../domain/odometer";
import { odometerReadingRepository } from "../../repositories/odometerReading.repository";
import { planItemRepository } from "../../repositories/planItem.repository";
import { vehicleRepository } from "../../repositories/vehicle.repository";
import { OdometerReadingDocument } from "../../types/odometer";
import { PlanItemDocument } from "../../types/plan-item";
import { DueResult, ItemStatus, OdometerConfidence } from "../../types/plan";
import { VehicleDocument } from "../../types/vehicle";
import { daysBetween, today } from "../../utils/date";

const READING_WINDOW_SIZE = 24;

export interface ItemStatusChange {
  id: string;
  code: string | null;
  name: string;
  previousStatus: ItemStatus;
  status: ItemStatus;
  dueDate: Date | null;
  dueReason: DueResult["dueReason"];
}

export interface StatusSummary {
  overdue: number;
  dueSoon: number;
  ok: number;
  unknown: number;
}

export interface RecalculationResult {
  vehicleId: string;
  kmPerDay: number;
  estimatedOdometer: number;
  reportedOdometer: number;
  reportedOdometerAt: Date;
  daysSinceReading: number;
  odometerConfidence: OdometerConfidence;
  healthScore: number;
  summary: StatusSummary;
  items: PlanItemDocument[];
  changedItems: ItemStatusChange[];
}

const summarize = (items: PlanItemDocument[]): StatusSummary => {
  const summary: StatusSummary = { overdue: 0, dueSoon: 0, ok: 0, unknown: 0 };

  for (const item of items) {
    if (!item.active) continue;
    if (item.status === "overdue") summary.overdue += 1;
    else if (item.status === "due_soon") summary.dueSoon += 1;
    else if (item.status === "ok") summary.ok += 1;
    else summary.unknown += 1;
  }

  return summary;
};

export const recalculateVehicle = async (
  vehicle: VehicleDocument,
  session?: ClientSession,
): Promise<RecalculationResult> => {
  const now = today();

  const readings = (await odometerReadingRepository.find({ vehicleId: vehicle._id }, null, {
    sort: { date: -1 },
    limit: READING_WINDOW_SIZE,
  })) as OdometerReadingDocument[];

  const kmPerDay = computeKmPerDay(readings, now);

  const latest = readings.reduce<OdometerReadingDocument | null>(
    (newest, reading) =>
      !newest || reading.date.getTime() > newest.date.getTime()
        ? reading
        : newest,
    null,
  );

  const reportedOdometer = latest ? latest.km : vehicle.currentOdometer;
  const reportedOdometerAt = latest ? latest.date : vehicle.currentOdometerAt;

  const estimatedOdometer = estimateCurrentOdometer(
    { currentOdometer: reportedOdometer, currentOdometerAt: reportedOdometerAt, kmPerDay },
    now,
  );

  const items = (await planItemRepository.find({
    vehicleId: vehicle._id,
  })) as PlanItemDocument[];

  const context = { today: now, estimatedOdometer, kmPerDay };
  const changedItems: ItemStatusChange[] = [];
  const operations = [];

  for (const item of items) {
    const result = computeItemStatus(item, context);
    const previousStatus = item.status;

    if (previousStatus !== result.status) {
      changedItems.push({
        id: String(item._id),
        code: item.code ?? null,
        name: item.name,
        previousStatus,
        status: result.status,
        dueDate: result.dueDate,
        dueReason: result.dueReason,
      });
    }

    item.status = result.status;
    item.dueDate = result.dueDate;
    item.dueReason = result.dueReason;
    item.nextDueKm = result.nextDueKm;
    item.nextDueDate = result.nextDueDate;
    item.calculatedAt = now;

    operations.push({
      updateOne: {
        filter: { _id: item._id },
        update: {
          $set: {
            status: result.status,
            dueDate: result.dueDate,
            dueReason: result.dueReason,
            nextDueKm: result.nextDueKm,
            nextDueDate: result.nextDueDate,
            calculatedAt: now,
          },
        },
      },
    });
  }

  if (operations.length) {
    await planItemRepository.bulkWrite(
      operations,
      session ? { session } : undefined,
    );
  }

  const healthScore = computeHealthScore(items, context);
  const daysSinceReading = daysBetween(now, reportedOdometerAt);

  await vehicleRepository.updateOne(
    { _id: vehicle._id },
    {
      $set: {
        kmPerDay,
        healthScore,
        currentOdometer: reportedOdometer,
        currentOdometerAt: reportedOdometerAt,
      },
    },
    session ? { session } : undefined,
  );

  return {
    vehicleId: String(vehicle._id),
    kmPerDay,
    estimatedOdometer,
    reportedOdometer,
    reportedOdometerAt,
    daysSinceReading,
    odometerConfidence: odometerConfidence(daysSinceReading),
    healthScore,
    summary: summarize(items),
    items,
    changedItems,
  };
};

export const recalculateVehicleById = async (
  vehicleId: Types.ObjectId,
): Promise<RecalculationResult | null> => {
  const vehicle = (await vehicleRepository.findById(
    vehicleId,
  )) as VehicleDocument | null;

  if (!vehicle) return null;
  return recalculateVehicle(vehicle);
};
