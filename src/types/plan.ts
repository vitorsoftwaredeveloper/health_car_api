export type DueType = "km" | "time" | "both" | "inspection";
export type ItemStatus = "unknown" | "ok" | "due_soon" | "overdue";
export type Criticality = "critical" | "high" | "medium" | "low";
export type DueReason = "km" | "time";
export type OdometerConfidence = "high" | "medium" | "low";

export interface PlanItemCore {
  dueType: DueType;
  criticality: Criticality;
  intervalKm?: number | null;
  intervalMonths?: number | null;
  lastServiceKm?: number | null;
  lastServiceDate?: Date | null;
  leadTimeDays: number;
  leadTimeKm: number;
  snoozedUntil?: Date | null;
  snoozedUntilKm?: number | null;
  muted?: boolean;
  active?: boolean;
}

export interface OdometerReadingCore {
  km: number;
  date: Date;
}

export interface VehicleOdometerCore {
  currentOdometer: number;
  currentOdometerAt: Date;
  kmPerDay: number;
}

export interface DueContext {
  today: Date;

  estimatedOdometer: number;
  kmPerDay: number;
}

export interface DueResult {
  status: ItemStatus;
  dueDate: Date | null;
  dueReason: DueReason | null;
  nextDueKm: number | null;
  nextDueDate: Date | null;
  kmRemaining: number | null;
  daysRemaining: number | null;
}
