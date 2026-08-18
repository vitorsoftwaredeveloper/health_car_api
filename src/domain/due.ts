import { addDays, addMonths, daysBetween } from "../utils/date";
import { LEAD_TIME_KM_RATIO, MIN_LEAD_TIME_KM } from "./constants";
import { DueContext, DueResult, PlanItemCore } from "../types/plan";

const UNKNOWN: DueResult = {
  status: "unknown",
  dueDate: null,
  dueReason: null,
  nextDueKm: null,
  nextDueDate: null,
  kmRemaining: null,
  daysRemaining: null,
};

export const defaultLeadTimeKm = (intervalKm?: number | null): number =>
  Math.max(MIN_LEAD_TIME_KM, Math.round((intervalKm ?? 0) * LEAD_TIME_KM_RATIO));

const tracksKm = (item: PlanItemCore): boolean =>
  (item.dueType === "km" ||
    item.dueType === "both" ||
    item.dueType === "inspection") &&
  !!item.intervalKm &&
  item.lastServiceKm != null;

const tracksTime = (item: PlanItemCore): boolean =>
  (item.dueType === "time" || item.dueType === "both") &&
  !!item.intervalMonths &&
  item.lastServiceDate != null;

export const computeItemStatus = (
  item: PlanItemCore,
  ctx: DueContext,
): DueResult => {
  const hasKm = tracksKm(item);
  const hasTime = tracksTime(item);

  if (!hasKm && !hasTime) return UNKNOWN;

  const leadKm = item.leadTimeKm || defaultLeadTimeKm(item.intervalKm);

  let nextDueKm: number | null = null;
  let kmRemaining: number | null = null;
  let dueByKm: Date | null = null;

  if (hasKm) {
    nextDueKm = (item.lastServiceKm as number) + (item.intervalKm as number);
    kmRemaining = nextDueKm - ctx.estimatedOdometer;
    const kmPerDay = Math.max(1, ctx.kmPerDay);
    dueByKm = addDays(ctx.today, Math.round(kmRemaining / kmPerDay));
  }

  let nextDueDate: Date | null = null;
  let daysRemaining: number | null = null;

  if (hasTime) {
    nextDueDate = addMonths(
      item.lastServiceDate as Date,
      item.intervalMonths as number,
    );
    daysRemaining = daysBetween(nextDueDate, ctx.today);
  }

  let dueDate: Date | null = null;
  let dueReason: DueResult["dueReason"] = null;

  if (dueByKm && nextDueDate) {
    if (dueByKm.getTime() <= nextDueDate.getTime()) {
      dueDate = dueByKm;
      dueReason = "km";
    } else {
      dueDate = nextDueDate;
      dueReason = "time";
    }
  } else if (dueByKm) {
    dueDate = dueByKm;
    dueReason = "km";
  } else {
    dueDate = nextDueDate;
    dueReason = "time";
  }

  const base = { dueDate, dueReason, nextDueKm, nextDueDate, kmRemaining, daysRemaining };

  const kmExpired = kmRemaining != null && kmRemaining <= 0;
  const timeExpired = daysRemaining != null && daysRemaining <= 0;
  const kmNear = kmRemaining != null && kmRemaining <= leadKm;
  const timeNear = daysRemaining != null && daysRemaining <= item.leadTimeDays;

  if (item.dueType === "inspection") {
    return { ...base, status: kmExpired || kmNear ? "due_soon" : "ok" };
  }

  if (kmExpired || timeExpired) return { ...base, status: "overdue" };
  if (kmNear || timeNear) return { ...base, status: "due_soon" };
  return { ...base, status: "ok" };
};

export const isAlertSuppressed = (
  item: PlanItemCore,
  ctx: DueContext,
): boolean => {
  if (item.muted) return true;
  if (item.snoozedUntil && item.snoozedUntil.getTime() > ctx.today.getTime()) {
    return true;
  }
  if (item.snoozedUntilKm != null && ctx.estimatedOdometer < item.snoozedUntilKm) {
    return true;
  }
  return false;
};
