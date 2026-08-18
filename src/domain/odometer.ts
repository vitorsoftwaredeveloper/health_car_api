import {
  KM_PER_DAY_FALLBACK,
  ODOMETER_AGING_DAYS,
  ODOMETER_STALE_DAYS,
  ODOMETER_WINDOW_DAYS,
} from "./constants";
import { daysBetween } from "../utils/date";
import {
  OdometerConfidence,
  OdometerReadingCore,
  VehicleOdometerCore,
} from "../types/plan";

export const computeKmPerDay = (
  readings: OdometerReadingCore[],
  today: Date,
): number => {
  const window = readings
    .filter((r) => daysBetween(today, r.date) <= ODOMETER_WINDOW_DAYS)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (window.length < 2) return KM_PER_DAY_FALLBACK;

  const first = window[0];
  const last = window[window.length - 1];
  const days = Math.max(1, daysBetween(last.date, first.date));
  const km = last.km - first.km;

  if (km <= 0) return KM_PER_DAY_FALLBACK;
  return Math.max(1, Math.round(km / days));
};

export const estimateCurrentOdometer = (
  vehicle: VehicleOdometerCore,
  today: Date,
): number => {
  const days = daysBetween(today, vehicle.currentOdometerAt);
  if (days <= 0) return vehicle.currentOdometer;
  return vehicle.currentOdometer + Math.round(vehicle.kmPerDay * days);
};

export const odometerConfidence = (
  daysSinceReading: number,
): OdometerConfidence => {
  if (daysSinceReading > ODOMETER_STALE_DAYS) return "low";
  if (daysSinceReading >= ODOMETER_AGING_DAYS) return "medium";
  return "high";
};
