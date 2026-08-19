import { planItemRepository } from "../../repositories/planItem.repository";
import { PlanItemDocument } from "../../types/plan-item";
import { Requester } from "../../types/user";
import { httpError, STATUS_CODE } from "../../utils/errors";
import {
  RegisterMaintenanceResult,
  registerMaintenanceEvent,
} from "../maintenance/maintenance.service";
import { loadAccessibleAlert } from "./alertInbox.service";

export interface ResolveAlertPayload {
  km: number;
  date?: string;
}

export const resolveAlert = async (
  requester: Requester,
  alertId: string,
  payload: ResolveAlertPayload,
): Promise<RegisterMaintenanceResult> => {
  const alert = await loadAccessibleAlert(requester, alertId);

  if (alert.status === "resolved") {
    throw httpError(
      STATUS_CODE.CONFLICT,
      "ALERT_ALREADY_RESOLVED",
      "Este alerta já foi resolvido.",
    );
  }

  const planItem = (await planItemRepository.findOne({
    _id: alert.planItemId,
  })) as PlanItemDocument | null;

  if (!planItem) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "PLAN_ITEM_NOT_FOUND",
      "Item do plano não encontrado.",
    );
  }

  return registerMaintenanceEvent(
    requester,
    String(alert.vehicleId),
    {
      km: payload.km,
      date: payload.date,
      type: "preventive",
      items: [
        {
          planItemId: String(planItem._id),
          description: planItem.name,
          action: "replace",
        },
      ],
    },
    "quick_log",
  );
};
