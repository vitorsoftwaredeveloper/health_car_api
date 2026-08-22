import { Types } from "mongoose";

jest.mock("../../src/repositories/alert.repository", () => ({
  alertRepository: { find: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn() },
}));
jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: { findOne: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../src/repositories/vehicle.repository", () => ({
  vehicleRepository: { find: jest.fn(), findById: jest.fn() },
}));

import { alertRepository } from "../../src/repositories/alert.repository";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { vehicleRepository } from "../../src/repositories/vehicle.repository";
import {
  dismissAlert,
  listAlerts,
  markAlertAsRead,
  snoozeAlert,
} from "../../src/services/alerts/alertInbox.service";
import { AlertDocument } from "../../src/types/alert";
import { Requester } from "../../src/types/user";
import { addDays, today } from "../../src/utils/date";

const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const planItemId = new Types.ObjectId();
const alertId = new Types.ObjectId();

const owner: Requester = {
  userId: new Types.ObjectId(),
  accountId,
  role: "owner",
  user: {} as any,
};

const alert = (overrides: Partial<AlertDocument> = {}): AlertDocument =>
  ({
    _id: alertId,
    accountId,
    vehicleId,
    planItemId,
    cycle: 1,
    milestone: "OVERDUE_W1",
    severity: "urgent",
    title: "Fluido de freio venceu",
    message: "Vencido há 3 dias, por tempo.",
    dueDate: addDays(today(), -3),
    status: "pending",
    createdAt: new Date("2026-08-18T09:00:00.000Z"),
    ...overrides,
  }) as AlertDocument;

beforeEach(() => {
  (alertRepository.findOne as jest.Mock).mockResolvedValue(alert());
  (alertRepository.find as jest.Mock).mockResolvedValue([alert()]);
  (alertRepository.findOneAndUpdate as jest.Mock).mockImplementation(
    async (_filter: any, update: any) => alert(update.$set),
  );
  (vehicleRepository.find as jest.Mock).mockResolvedValue([{ _id: vehicleId }]);
  (vehicleRepository.findById as jest.Mock).mockResolvedValue({
    currentOdometer: 79000,
    currentOdometerAt: today(),
    kmPerDay: 40,
  });
});

describe("listAlerts", () => {
  it("escopa pela conta e ordena do mais novo para o mais velho", async () => {
    await listAlerts(owner, {});

    const [filter, , options] = (alertRepository.find as jest.Mock).mock.calls[0];
    expect(filter).toEqual({ accountId });
    expect(options).toEqual({ sort: { createdAt: -1 }, limit: 31 });
  });

  it("filtra por status e veículo", async () => {
    await listAlerts(owner, { status: "pending", vehicleId: String(vehicleId) });

    expect((alertRepository.find as jest.Mock).mock.calls[0][0]).toEqual({
      accountId,
      status: "pending",
      vehicleId,
    });
  });

  it("recusa id de veículo malformado", async () => {
    await expect(listAlerts(owner, { vehicleId: "nao-e-id" })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("devolve cursor quando há próxima página", async () => {
    (alertRepository.find as jest.Mock).mockResolvedValue([
      alert({ createdAt: new Date("2026-08-18T09:00:00.000Z") }),
      alert({ createdAt: new Date("2026-08-17T09:00:00.000Z") }),
    ]);

    const result = await listAlerts(owner, { limit: 1 });

    expect(result.alerts).toHaveLength(1);
    expect(result.nextCursor).toBe("2026-08-18T09:00:00.000Z");
  });

  it("aplica o cursor recebido", async () => {
    await listAlerts(owner, { before: "2026-08-18T09:00:00.000Z" });

    expect((alertRepository.find as jest.Mock).mock.calls[0][0].createdAt).toEqual({
      $lt: new Date("2026-08-18T09:00:00.000Z"),
    });
  });
});

describe("markAlertAsRead", () => {
  it("marca com data de leitura", async () => {
    const view = await markAlertAsRead(owner, String(alertId));

    const update = (alertRepository.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(update.status).toBe("read");
    expect(update.readAt).toBeInstanceOf(Date);
    expect(view.status).toBe("read");
  });

  it("não mexe em alerta que já saiu de pendente", async () => {
    (alertRepository.findOne as jest.Mock).mockResolvedValue(alert({ status: "snoozed" }));

    const view = await markAlertAsRead(owner, String(alertId));

    expect(alertRepository.findOneAndUpdate).not.toHaveBeenCalled();
    expect(view.status).toBe("snoozed");
  });

  it("esconde alerta de outra conta com 404", async () => {
    (alertRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(markAlertAsRead(owner, String(alertId))).rejects.toMatchObject({
      statusCode: 404,
      code: "ALERT_NOT_FOUND",
    });
  });

  it("recusa id malformado", async () => {
    await expect(markAlertAsRead(owner, "nao-e-id")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("dismissAlert", () => {
  it("descarta o aviso sem tocar no item", async () => {
    const view = await dismissAlert(owner, String(alertId));

    expect(view.status).toBe("dismissed");
    expect(planItemRepository.updateOne).not.toHaveBeenCalled();
  });

  it("recusa descartar alerta já resolvido", async () => {
    (alertRepository.findOne as jest.Mock).mockResolvedValue(alert({ status: "resolved" }));

    await expect(dismissAlert(owner, String(alertId))).rejects.toMatchObject({
      statusCode: 409,
      code: "ALERT_ALREADY_RESOLVED",
    });
  });
});

describe("snoozeAlert", () => {
  it("adia por dias e propaga a supressão para o item do plano", async () => {
    const view = await snoozeAlert(owner, String(alertId), { days: 15 });

    const update = (planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update.snoozedUntil).toEqual(addDays(today(), 15));
    expect(update.snoozedUntilKm).toBeNull();
    expect(view.status).toBe("snoozed");
  });

  it("adia por quilometragem contando a partir do odômetro estimado", async () => {
    await snoozeAlert(owner, String(alertId), { km: 1000 });

    const update = (planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update.snoozedUntilKm).toBe(80000);
    expect(update.snoozedUntil).toBeNull();
  });

  it("exige dias ou quilometragem", async () => {
    await expect(snoozeAlert(owner, String(alertId), {})).rejects.toMatchObject({
      statusCode: 400,
      code: "SNOOZE_TARGET_REQUIRED",
    });
  });

  it("recusa adiar alerta já resolvido", async () => {
    (alertRepository.findOne as jest.Mock).mockResolvedValue(alert({ status: "resolved" }));

    await expect(
      snoozeAlert(owner, String(alertId), { days: 5 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
