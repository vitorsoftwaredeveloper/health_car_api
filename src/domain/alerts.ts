import { Criticality, DueReason, ItemStatus } from "../types/plan";

export const MAX_OVERDUE_WEEKS = 8;
export const LEAD_MILESTONE_DAYS = 30;
export const NEAR_MILESTONE_DAYS = 7;

export type AlertMilestone = string;
export type AlertSeverity = "info" | "warning" | "urgent";

export interface MessageContext {
  status: ItemStatus;
  dueReason: DueReason | null;
  kmRemaining: number | null;
  daysRemaining: number | null;
}

export interface UrgencyContext {
  status: ItemStatus;
  dueDate: Date | null;
  criticality: "critical" | "high" | "medium" | "low";
}

const STATUS_ORDER: Record<ItemStatus, number> = {
  overdue: 0,
  due_soon: 1,
  ok: 2,
  unknown: 3,
};

const CRITICALITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
} as const;

export const formatKm = (km: number): string =>
  `${Math.abs(km).toLocaleString("pt-BR")} km`;

const pluralDays = (days: number): string =>
  Math.abs(days) === 1 ? "1 dia" : `${Math.abs(days)} dias`;

export const buildItemMessage = (context: MessageContext): string => {
  const { status, dueReason, kmRemaining, daysRemaining } = context;

  if (status === "unknown") {
    return "Sem histórico. Informe a última troca para começar a acompanhar.";
  }

  if (status === "overdue") {
    if (dueReason === "time" && daysRemaining != null) {
      return `Vencido há ${pluralDays(daysRemaining)}, por tempo.`;
    }
    if (kmRemaining != null) {
      return `Vencido há ${formatKm(kmRemaining)}, por quilometragem.`;
    }
    return "Vencido.";
  }

  if (status === "due_soon") {
    if (dueReason === "time" && daysRemaining != null) {
      return `Vence em ${pluralDays(daysRemaining)}, por tempo.`;
    }
    if (kmRemaining != null) {
      return `Vence em ${formatKm(kmRemaining)}, por quilometragem.`;
    }
    return "Perto de vencer.";
  }

  if (dueReason === "time" && daysRemaining != null) {
    return `Em dia. Vence em ${pluralDays(daysRemaining)}.`;
  }
  if (kmRemaining != null) {
    return `Em dia. Vence em ${formatKm(kmRemaining)}.`;
  }
  return "Em dia.";
};

export const compareByUrgency = (
  a: UrgencyContext,
  b: UrgencyContext,
): number => {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (byStatus !== 0) return byStatus;

  if (a.dueDate && b.dueDate) {
    const byDate = a.dueDate.getTime() - b.dueDate.getTime();
    if (byDate !== 0) return byDate;
  } else if (a.dueDate) {
    return -1;
  } else if (b.dueDate) {
    return 1;
  }

  return CRITICALITY_ORDER[a.criticality] - CRITICALITY_ORDER[b.criticality];
};

export const resolveMilestone = (
  daysUntilDue: number | null,
): AlertMilestone | null => {
  if (daysUntilDue == null) return null;

  if (daysUntilDue > LEAD_MILESTONE_DAYS) return null;
  if (daysUntilDue > NEAR_MILESTONE_DAYS) return "D30";
  if (daysUntilDue > 0) return "D7";
  if (daysUntilDue === 0) return "D0";

  const weeks = Math.ceil(-daysUntilDue / 7);
  if (weeks > MAX_OVERDUE_WEEKS) return null;

  return `OVERDUE_W${weeks}`;
};

export const isOverdueMilestone = (milestone: AlertMilestone): boolean =>
  milestone.startsWith("OVERDUE_W");

export const milestoneSeverity = (
  milestone: AlertMilestone,
  criticality: Criticality,
): AlertSeverity => {
  if (isOverdueMilestone(milestone) || milestone === "D0") {
    return criticality === "critical" || criticality === "high"
      ? "urgent"
      : "warning";
  }

  if (milestone === "D7") return "warning";
  return "info";
};

export const buildAlertTitle = (
  itemName: string,
  milestone: AlertMilestone,
): string => {
  if (isOverdueMilestone(milestone) || milestone === "D0") {
    return `${itemName} venceu`;
  }
  if (milestone === "D7") return `${itemName} vence esta semana`;
  return `${itemName} vence em breve`;
};
