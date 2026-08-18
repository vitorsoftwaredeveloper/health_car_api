import { daysBetween } from "../utils/date";
import { CRITICALITY_WEIGHT } from "./constants";
import { computeItemStatus } from "./due";
import { DueContext, PlanItemCore } from "../types/plan";

const DAYS_PER_MONTH = 30.44;

interface ScoredItem {
  health: number;
  weight: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const consumedFraction = (
  item: PlanItemCore,
  ctx: DueContext,
): number | null => {
  const fractions: number[] = [];

  if (item.intervalKm && item.lastServiceKm != null && item.dueType !== "time") {
    const used = ctx.estimatedOdometer - item.lastServiceKm;
    fractions.push(used / item.intervalKm);
  }

  if (
    item.intervalMonths &&
    item.lastServiceDate &&
    (item.dueType === "time" || item.dueType === "both")
  ) {
    const usedDays = daysBetween(ctx.today, item.lastServiceDate);
    fractions.push(usedDays / (item.intervalMonths * DAYS_PER_MONTH));
  }

  if (!fractions.length) return null;
  return Math.max(...fractions);
};

export const itemHealth = (
  item: PlanItemCore,
  ctx: DueContext,
): number | null => {
  const { status } = computeItemStatus(item, ctx);
  if (status === "unknown") return null;
  if (status === "overdue") return 0;

  const consumed = consumedFraction(item, ctx);
  if (consumed === null) return null;
  return clamp(1 - consumed, 0, 1);
};

export const computeHealthScore = (
  items: PlanItemCore[],
  ctx: DueContext,
): number => {
  const scored: ScoredItem[] = [];

  for (const item of items) {
    if (item.active === false) continue;
    const health = itemHealth(item, ctx);
    if (health === null) continue;
    scored.push({ health, weight: CRITICALITY_WEIGHT[item.criticality] });
  }

  if (!scored.length) return 100;

  const weighted = scored.reduce((sum, e) => sum + e.health * e.weight, 0);
  const total = scored.reduce((sum, e) => sum + e.weight, 0);

  return Math.round((weighted / total) * 100);
};

export const healthBand = (score: number): "good" | "warning" | "bad" =>
  score >= 85 ? "good" : score >= 60 ? "warning" : "bad";
