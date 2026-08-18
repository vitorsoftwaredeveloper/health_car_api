export const KM_PER_DAY_FALLBACK = 33;

export const ODOMETER_WINDOW_DAYS = 90;

export const ODOMETER_STALE_DAYS = 45;
export const ODOMETER_AGING_DAYS = 30;

export const DEFAULT_LEAD_TIME_DAYS = 30;
export const MIN_LEAD_TIME_KM = 500;
export const LEAD_TIME_KM_RATIO = 0.1;

export const CRITICALITY_WEIGHT = {
  critical: 5,
  high: 3,
  medium: 2,
  low: 1,
} as const;
