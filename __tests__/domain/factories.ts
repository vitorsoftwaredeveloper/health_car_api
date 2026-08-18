import { DueContext, PlanItemCore } from "../../src/types/plan";

export const d = (iso: string): Date => new Date(`${iso}T03:00:00.000Z`);

export const item = (over: Partial<PlanItemCore> = {}): PlanItemCore => ({
  dueType: "both",
  criticality: "medium",
  intervalKm: 10000,
  intervalMonths: 12,
  lastServiceKm: 70000,
  lastServiceDate: d("2025-08-18"),
  leadTimeDays: 30,
  leadTimeKm: 1000,
  muted: false,
  active: true,
  ...over,
});

export const ctx = (over: Partial<DueContext> = {}): DueContext => ({
  today: d("2026-08-18"),
  estimatedOdometer: 75000,
  kmPerDay: 33,
  ...over,
});
