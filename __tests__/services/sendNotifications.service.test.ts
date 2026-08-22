import { Types } from "mongoose";

jest.mock("../../src/repositories/vehicle.repository", () => ({
  vehicleRepository: { findById: jest.fn() },
}));
jest.mock("../../src/repositories/alert.repository", () => ({
  alertRepository: { find: jest.fn() },
}));
jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: { find: jest.fn() },
}));
jest.mock("../../src/repositories/user.repository", () => ({
  userRepository: { find: jest.fn() },
}));
jest.mock("../../src/repositories/pushDevice.repository", () => ({
  pushDeviceRepository: { find: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../src/repositories/notification.repository", () => ({
  notificationRepository: { insertOne: jest.fn(), count: jest.fn() },
}));
jest.mock("../../src/libs/webpush", () => ({ sendPush: jest.fn() }));

import { vehicleRepository } from "../../src/repositories/vehicle.repository";
import { alertRepository } from "../../src/repositories/alert.repository";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { userRepository } from "../../src/repositories/user.repository";
import { pushDeviceRepository } from "../../src/repositories/pushDevice.repository";
import { notificationRepository } from "../../src/repositories/notification.repository";
import { sendPush } from "../../src/libs/webpush";
import { runSendNotifications } from "../../src/services/notifications/sendNotifications.service";
import { defaultPreferences, mergePreferences } from "../../src/domain/preferences";

const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const userId = new Types.ObjectId();
const planItemId = new Types.ObjectId();
const alertId = new Types.ObjectId();
const deviceId = new Types.ObjectId();

const message = (alertIds: string[] = [String(alertId)]) => ({
  body: JSON.stringify({
    accountId: String(accountId),
    vehicleId: String(vehicleId),
    alertIds,
  }),
});

const record = () =>
  (notificationRepository.insertOne as jest.Mock).mock.calls[0][0];

beforeEach(() => {
  (vehicleRepository.findById as jest.Mock).mockResolvedValue({
    _id: vehicleId,
    accountId,
    nickname: "Meu Civic",
  });
  (alertRepository.find as jest.Mock).mockResolvedValue([
    {
      _id: alertId,
      planItemId,
      milestone: "D7",
      title: "Fluido de freio vence esta semana",
      message: "Vence em 5 dias, por tempo.",
    },
  ]);
  (planItemRepository.find as jest.Mock).mockResolvedValue([
    { _id: planItemId, name: "Fluido de freio" },
  ]);
  (userRepository.find as jest.Mock).mockResolvedValue([
    {
      _id: userId,
      accountId,
      preferences: mergePreferences(defaultPreferences(), { quietHours: null }),
    },
  ]);
  (pushDeviceRepository.find as jest.Mock).mockResolvedValue([
    { _id: deviceId, endpoint: "https://push/1", keys: { p256dh: "p", auth: "a" } },
  ]);
  (notificationRepository.count as jest.Mock).mockResolvedValue(0);
  (notificationRepository.insertOne as jest.Mock).mockResolvedValue({});
  (sendPush as jest.Mock).mockResolvedValue({ ok: true, gone: false });
});

describe("runSendNotifications", () => {
  it("envia um push e grava a notificação", async () => {
    const result = await runSendNotifications([message()]);

    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(record()).toMatchObject({
      status: "sent",
      title: "Fluido de freio vence esta semana",
      deepLink: `/vehicles/${vehicleId}?item=${planItemId}`,
    });
    expect(result).toMatchObject({ received: 1, sent: 1, skipped: 0, failed: 0 });
  });

  it("agrega vários alertas num push só", async () => {
    const second = new Types.ObjectId();
    const secondItem = new Types.ObjectId();
    (alertRepository.find as jest.Mock).mockResolvedValue([
      { _id: alertId, planItemId, milestone: "D7", title: "a", message: "m" },
      { _id: second, planItemId: secondItem, milestone: "D30", title: "b", message: "m" },
    ]);
    (planItemRepository.find as jest.Mock).mockResolvedValue([
      { _id: planItemId, name: "Fluido de freio" },
      { _id: secondItem, name: "Óleo do motor" },
    ]);

    await runSendNotifications([message()]);

    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(record().title).toBe("Meu Civic: 2 itens pedindo atenção");
    expect(record().alertIds).toHaveLength(2);
  });

  it("não envia duas vezes no mesmo dia para o mesmo veículo", async () => {
    (notificationRepository.count as jest.Mock).mockResolvedValue(1);

    const result = await runSendNotifications([message()]);

    expect(sendPush).not.toHaveBeenCalled();
    expect(record()).toMatchObject({ status: "skipped", skipReason: "already_sent_today" });
    expect(result.skipped).toBe(1);
  });

  it("grava skipped quando o marco está desligado", async () => {
    (userRepository.find as jest.Mock).mockResolvedValue([
      {
        _id: userId,
        preferences: mergePreferences(defaultPreferences(), {
          quietHours: null,
          milestones: { D7: false },
        }),
      },
    ]);

    await runSendNotifications([message()]);

    expect(sendPush).not.toHaveBeenCalled();
    expect(record()).toMatchObject({ status: "skipped", skipReason: "milestone_disabled" });
  });

  it("grava skipped quando não há dispositivo inscrito", async () => {
    (pushDeviceRepository.find as jest.Mock).mockResolvedValue([]);

    await runSendNotifications([message()]);

    expect(record()).toMatchObject({ status: "skipped", skipReason: "no_device" });
  });

  it("desativa o endpoint morto e marca a notificação como falha", async () => {
    (sendPush as jest.Mock).mockResolvedValue({
      ok: false,
      gone: true,
      statusCode: 410,
      error: "gone",
    });

    const result = await runSendNotifications([message()]);

    const [filter, update] = (pushDeviceRepository.updateOne as jest.Mock).mock.calls[0];
    expect(filter).toEqual({ _id: deviceId });
    expect(update.$set).toEqual({ active: false });
    expect(record()).toMatchObject({ status: "failed", error: "gone" });
    expect(result).toMatchObject({ failed: 1, devicesDeactivated: 1 });
  });

  it("marca a hora do último envio no dispositivo que recebeu", async () => {
    await runSendNotifications([message()]);

    const update = (pushDeviceRepository.updateOne as jest.Mock).mock.calls[0][1];
    expect(update.$set.lastSentAt).toBeInstanceOf(Date);
  });

  it("ignora mensagem cujos alertas já saíram de pendente", async () => {
    (alertRepository.find as jest.Mock).mockResolvedValue([]);

    const result = await runSendNotifications([message()]);

    expect(notificationRepository.insertOne).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, skipped: 0 });
  });

  it("ignora veículo que não existe mais", async () => {
    (vehicleRepository.findById as jest.Mock).mockResolvedValue(null);

    await runSendNotifications([message()]);

    expect(notificationRepository.insertOne).not.toHaveBeenCalled();
  });

  it("busca só os donos da conta como destinatários", async () => {
    (userRepository.find as jest.Mock).mockResolvedValue([
      { _id: userId, preferences: mergePreferences(defaultPreferences(), { quietHours: null }) },
    ]);

    const result = await runSendNotifications([message()]);

    expect((userRepository.find as jest.Mock).mock.calls[0][0]).toEqual({
      accountId,
      role: "owner",
    });
    expect(result.sent).toBe(1);
  });

  it("entrega o lembrete de odômetro sem olhar os marcos", async () => {
    (userRepository.find as jest.Mock).mockResolvedValue([
      {
        _id: userId,
        preferences: mergePreferences(defaultPreferences(), {
          quietHours: null,
          milestones: { D30: false, D7: false, D0: false, OVERDUE_WEEKLY: false },
        }),
      },
    ]);

    const result = await runSendNotifications([
      {
        body: JSON.stringify({
          accountId: String(accountId),
          vehicleId: String(vehicleId),
          kind: "odometer_reminder",
          daysSinceReading: 52,
        }),
      },
    ]);

    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(record()).toMatchObject({
      kind: "odometer_reminder",
      status: "sent",
      title: "Meu Civic: quanto está o odômetro?",
      alertIds: [],
    });
    expect(result.sent).toBe(1);
    expect(alertRepository.find).not.toHaveBeenCalled();
  });

  it("não repete o lembrete dentro de 15 dias", async () => {
    (notificationRepository.count as jest.Mock).mockResolvedValue(1);

    const result = await runSendNotifications([
      {
        body: JSON.stringify({
          accountId: String(accountId),
          vehicleId: String(vehicleId),
          kind: "odometer_reminder",
          daysSinceReading: 60,
        }),
      },
    ]);

    expect(sendPush).not.toHaveBeenCalled();
    expect(record()).toMatchObject({
      status: "skipped",
      skipReason: "reminder_recently_sent",
    });
    expect(result.skipped).toBe(1);
  });

  it("marca kind alert na notificação de vencimento", async () => {
    await runSendNotifications([message()]);

    expect(record().kind).toBe("alert");
  });

  it("conta falha quando a mensagem não é JSON válido", async () => {
    const result = await runSendNotifications([{ body: "não é json" }]);

    expect(result.failed).toBe(1);
  });
});
