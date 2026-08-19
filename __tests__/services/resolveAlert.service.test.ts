import { Types } from "mongoose";

jest.mock("../../src/services/alerts/alertInbox.service", () => ({
  loadAccessibleAlert: jest.fn(),
}));
jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: { findOne: jest.fn() },
}));
jest.mock("../../src/services/maintenance/maintenance.service", () => ({
  registerMaintenanceEvent: jest.fn(async () => ({
    event: { id: "evt" },
    updatedItems: [],
    closedAlerts: 1,
    healthScore: 88,
  })),
}));

import { loadAccessibleAlert } from "../../src/services/alerts/alertInbox.service";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { registerMaintenanceEvent } from "../../src/services/maintenance/maintenance.service";
import { resolveAlert } from "../../src/services/alerts/resolveAlert.service";
import { Requester } from "../../src/types/user";

const vehicleId = new Types.ObjectId();
const planItemId = new Types.ObjectId();
const alertId = new Types.ObjectId();

const requester: Requester = {
  userId: new Types.ObjectId(),
  accountId: new Types.ObjectId(),
  role: "owner",
  user: {} as any,
};

beforeEach(() => {
  (loadAccessibleAlert as jest.Mock).mockResolvedValue({
    _id: alertId,
    vehicleId,
    planItemId,
    status: "pending",
  });
  (planItemRepository.findOne as jest.Mock).mockResolvedValue({
    _id: planItemId,
    name: "Fluido de freio",
  });
});

describe("resolveAlert", () => {
  it("registra evento quick_log com o item do alerta", async () => {
    const result = await resolveAlert(requester, String(alertId), {
      km: 79010,
      date: "2026-08-18",
    });

    const [, vehicleArg, payload, source] = (registerMaintenanceEvent as jest.Mock).mock.calls[0];
    expect(vehicleArg).toBe(String(vehicleId));
    expect(source).toBe("quick_log");
    expect(payload.items).toEqual([
      {
        planItemId: String(planItemId),
        description: "Fluido de freio",
        action: "replace",
      },
    ]);
    expect(payload.km).toBe(79010);
    expect(result.closedAlerts).toBe(1);
  });

  it("recusa alerta já resolvido", async () => {
    (loadAccessibleAlert as jest.Mock).mockResolvedValue({ status: "resolved" });

    await expect(
      resolveAlert(requester, String(alertId), { km: 1 }),
    ).rejects.toMatchObject({ statusCode: 409, code: "ALERT_ALREADY_RESOLVED" });
  });

  it("recusa quando o item do plano sumiu", async () => {
    (planItemRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      resolveAlert(requester, String(alertId), { km: 1 }),
    ).rejects.toMatchObject({ statusCode: 404, code: "PLAN_ITEM_NOT_FOUND" });
  });
});
