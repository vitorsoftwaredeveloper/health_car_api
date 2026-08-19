import { Types } from "mongoose";

jest.mock("../../src/repositories/vehicle.repository", () => ({
  vehicleRepository: { find: jest.fn() },
}));
jest.mock("../../src/repositories/notification.repository", () => ({
  notificationRepository: { count: jest.fn() },
}));
jest.mock("../../src/libs/sqs", () => ({ enqueueNotifications: jest.fn() }));

import { vehicleRepository } from "../../src/repositories/vehicle.repository";
import { notificationRepository } from "../../src/repositories/notification.repository";
import { enqueueNotifications } from "../../src/libs/sqs";
import { runOdometerReminder } from "../../src/services/jobs/odometerReminder.service";
import { addDays, today } from "../../src/utils/date";

const vehicle = (daysSinceReading: number, id = new Types.ObjectId()) => ({
  _id: id,
  accountId: new Types.ObjectId(),
  currentOdometerAt: addDays(today(), -daysSinceReading),
});

beforeEach(() => {
  process.env.NOTIFICATIONS_QUEUE_URL = "http://localhost/queue";
  (vehicleRepository.find as jest.Mock).mockResolvedValue([]);
  (notificationRepository.count as jest.Mock).mockResolvedValue(0);
});

describe("runOdometerReminder", () => {
  it("procura só veículo ativo com leitura parada há mais de 45 dias", async () => {
    await runOdometerReminder();

    const filter = (vehicleRepository.find as jest.Mock).mock.calls[0][0];
    expect(filter.status).toBe("active");
    expect(filter.currentOdometerAt.$lt).toEqual(addDays(today(), -45));
  });

  it("enfileira o lembrete com os dias sem leitura", async () => {
    (vehicleRepository.find as jest.Mock).mockResolvedValueOnce([vehicle(52)]);

    const result = await runOdometerReminder();

    const [messages] = (enqueueNotifications as jest.Mock).mock.calls[0];
    expect(messages[0]).toMatchObject({
      kind: "odometer_reminder",
      daysSinceReading: 52,
    });
    expect(result).toMatchObject({
      vehiclesChecked: 1,
      remindersEnqueued: 1,
      recentlyReminded: 0,
    });
  });

  it("não insiste com quem já foi lembrado nos últimos 15 dias", async () => {
    (vehicleRepository.find as jest.Mock).mockResolvedValueOnce([vehicle(60)]);
    (notificationRepository.count as jest.Mock).mockResolvedValue(1);

    const result = await runOdometerReminder();

    const filter = (notificationRepository.count as jest.Mock).mock.calls[0][0];
    expect(filter.kind).toBe("odometer_reminder");
    expect(filter.createdAt.$gte).toEqual(addDays(today(), -15));
    expect(enqueueNotifications).not.toHaveBeenCalled();
    expect(result).toMatchObject({ vehiclesChecked: 1, recentlyReminded: 1 });
  });

  it("pagina pelo último id da página cheia", async () => {
    const lastId = new Types.ObjectId();
    const page = Array.from({ length: 49 }, () => vehicle(50)).concat([
      vehicle(50, lastId),
    ]);
    (vehicleRepository.find as jest.Mock)
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([]);

    await runOdometerReminder();

    expect((vehicleRepository.find as jest.Mock).mock.calls[1][0]._id).toEqual({
      $gt: lastId,
    });
  });

  it("não enfileira quando a fila não está configurada", async () => {
    delete process.env.NOTIFICATIONS_QUEUE_URL;
    (vehicleRepository.find as jest.Mock).mockResolvedValueOnce([vehicle(50)]);

    const result = await runOdometerReminder();

    expect(enqueueNotifications).not.toHaveBeenCalled();
    expect(result.remindersEnqueued).toBe(0);
  });
});
