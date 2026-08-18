import { Types } from "mongoose";

jest.mock("../../src/repositories/vehicle.repository", () => ({
  vehicleRepository: { find: jest.fn() },
}));
jest.mock("../../src/services/plan/recalculate.service", () => ({
  recalculateVehicle: jest.fn(async () => ({ evaluations: [] })),
}));
jest.mock("../../src/services/alerts/alert.service", () => ({
  syncAlertsForVehicle: jest.fn(async () => ({ created: [], duplicates: 0 })),
}));
jest.mock("../../src/libs/sqs", () => ({ enqueueNotifications: jest.fn() }));

import { vehicleRepository } from "../../src/repositories/vehicle.repository";
import { recalculateVehicle } from "../../src/services/plan/recalculate.service";
import { syncAlertsForVehicle } from "../../src/services/alerts/alert.service";
import { enqueueNotifications } from "../../src/libs/sqs";
import { runRecalculateHealth } from "../../src/services/jobs/recalculateHealth.service";

const vehicle = (id = new Types.ObjectId()) => ({
  _id: id,
  accountId: new Types.ObjectId(),
  status: "active",
});

beforeEach(() => {
  process.env.NOTIFICATIONS_QUEUE_URL = "http://localhost/queue";
  (recalculateVehicle as jest.Mock).mockResolvedValue({ evaluations: [] });
  (syncAlertsForVehicle as jest.Mock).mockResolvedValue({ created: [], duplicates: 0 });
  (vehicleRepository.find as jest.Mock).mockResolvedValue([]);
});

describe("runRecalculateHealth", () => {
  it("varre só veículo ativo e devolve o total processado", async () => {
    (vehicleRepository.find as jest.Mock).mockResolvedValueOnce([vehicle(), vehicle()]);

    const result = await runRecalculateHealth();

    expect((vehicleRepository.find as jest.Mock).mock.calls[0][0]).toEqual({
      status: "active",
    });
    expect(result.vehiclesProcessed).toBe(2);
    expect(recalculateVehicle).toHaveBeenCalledTimes(2);
  });

  it("pagina usando o último id da página cheia", async () => {
    const lastId = new Types.ObjectId();
    const page = Array.from({ length: 49 }, () => vehicle()).concat([vehicle(lastId)]);
    (vehicleRepository.find as jest.Mock)
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([]);

    await runRecalculateHealth();

    expect((vehicleRepository.find as jest.Mock).mock.calls[1][0]).toEqual({
      status: "active",
      _id: { $gt: lastId },
    });
  });

  it("enfileira uma mensagem por veículo com alerta novo", async () => {
    const target = vehicle();
    (vehicleRepository.find as jest.Mock).mockResolvedValueOnce([target]);
    (syncAlertsForVehicle as jest.Mock).mockResolvedValue({
      created: [{ _id: new Types.ObjectId() }, { _id: new Types.ObjectId() }],
      duplicates: 1,
    });

    const result = await runRecalculateHealth();

    const [messages] = (enqueueNotifications as jest.Mock).mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(messages[0].vehicleId).toBe(String(target._id));
    expect(messages[0].alertIds).toHaveLength(2);
    expect(result).toMatchObject({
      alertsCreated: 2,
      duplicatesSkipped: 1,
      vehiclesEnqueued: 1,
    });
  });

  it("não enfileira nada quando ninguém tem alerta novo", async () => {
    (vehicleRepository.find as jest.Mock).mockResolvedValueOnce([vehicle()]);

    const result = await runRecalculateHealth();

    expect(enqueueNotifications).not.toHaveBeenCalled();
    expect(result.vehiclesEnqueued).toBe(0);
  });

  it("não enfileira quando a fila não está configurada", async () => {
    delete process.env.NOTIFICATIONS_QUEUE_URL;
    (vehicleRepository.find as jest.Mock).mockResolvedValueOnce([vehicle()]);
    (syncAlertsForVehicle as jest.Mock).mockResolvedValue({
      created: [{ _id: new Types.ObjectId() }],
      duplicates: 0,
    });

    const result = await runRecalculateHealth();

    expect(enqueueNotifications).not.toHaveBeenCalled();
    expect(result.vehiclesEnqueued).toBe(0);
  });

  it("segue para o próximo veículo quando um falha", async () => {
    (vehicleRepository.find as jest.Mock).mockResolvedValueOnce([vehicle(), vehicle()]);
    (recalculateVehicle as jest.Mock)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ evaluations: [] });

    const result = await runRecalculateHealth();

    expect(result.failures).toBe(1);
    expect(result.vehiclesProcessed).toBe(1);
  });
});
