import { Types } from "mongoose";

jest.mock("../../src/repositories/odometerReading.repository", () => ({
  odometerReadingRepository: { find: jest.fn(), findOne: jest.fn(), insertOne: jest.fn() },
}));
jest.mock("../../src/services/vehicles/access.service", () => ({
  assertVehicleAccess: jest.fn(),
}));
jest.mock("../../src/services/plan/recalculate.service", () => ({
  recalculateVehicle: jest.fn(async () => ({
    kmPerDay: 41,
    estimatedOdometer: 79200,
    healthScore: 67,
    changedItems: [{ id: "1", code: "ENGINE_OIL", previousStatus: "ok", status: "due_soon" }],
  })),
}));

import { odometerReadingRepository } from "../../src/repositories/odometerReading.repository";
import { assertVehicleAccess } from "../../src/services/vehicles/access.service";
import { recalculateVehicle } from "../../src/services/plan/recalculate.service";
import {
  correctOdometerReading,
  createOdometerReading,
  listOdometerReadings,
} from "../../src/services/odometer/odometer.service";
import { Requester } from "../../src/types/user";
import { VehicleDocument } from "../../src/types/vehicle";

const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const userId = new Types.ObjectId();

const requester: Requester = { userId, accountId, role: "owner", user: {} as any };

const vehicle = {
  _id: vehicleId,
  accountId,
  currentOdometer: 77140,
  currentOdometerAt: new Date("2026-08-02"),
} as VehicleDocument;

const reading = (km: number, date: string, source = "manual") => ({
  _id: new Types.ObjectId(),
  vehicleId,
  km,
  date: new Date(date),
  source,
});

beforeEach(() => {
  (assertVehicleAccess as jest.Mock).mockResolvedValue(vehicle);
  (odometerReadingRepository.find as jest.Mock).mockResolvedValue([]);
  (odometerReadingRepository.insertOne as jest.Mock).mockImplementation(
    async (data: any) => ({ toObject: () => data }),
  );
});

describe("createOdometerReading", () => {
  it("grava leitura manual e devolve o efeito do recálculo", async () => {
    const result = await createOdometerReading(requester, String(vehicleId), {
      km: 79010,
      date: "2026-08-18",
    });

    const document = (odometerReadingRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(document.km).toBe(79010);
    expect(document.source).toBe("manual");
    expect(document.accountId).toBe(accountId);
    expect(document.createdBy).toBe(userId);
    expect(result.kmPerDay).toBe(41);
    expect(result.healthScore).toBe(67);
    expect(result.changedItems).toHaveLength(1);
    expect(recalculateVehicle).toHaveBeenCalledWith(vehicle);
  });

  it("exige acesso de escrita", async () => {
    await createOdometerReading(requester, String(vehicleId), { km: 79010 });

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "write");
  });

  it("aceita origem de abastecimento", async () => {
    await createOdometerReading(requester, String(vehicleId), {
      km: 79010,
      source: "refuel",
    });

    expect((odometerReadingRepository.insertOne as jest.Mock).mock.calls[0][0].source).toBe("refuel");
  });

  it("recusa data no futuro", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 2);

    await expect(
      createOdometerReading(requester, String(vehicleId), {
        km: 79010,
        date: future.toISOString().slice(0, 10),
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "FUTURE_DATE" });
  });

  it("recusa km menor que a leitura anterior", async () => {
    (odometerReadingRepository.find as jest.Mock).mockResolvedValueOnce([
      reading(78000, "2026-08-10"),
    ]);

    await expect(
      createOdometerReading(requester, String(vehicleId), { km: 77000, date: "2026-08-18" }),
    ).rejects.toMatchObject({ statusCode: 422, code: "ODOMETER_REGRESSION" });
  });

  it("recusa leitura retroativa acima da leitura seguinte", async () => {
    (odometerReadingRepository.find as jest.Mock)
      .mockResolvedValueOnce([reading(70000, "2026-06-01")])
      .mockResolvedValueOnce([reading(78000, "2026-08-10")]);

    await expect(
      createOdometerReading(requester, String(vehicleId), { km: 90000, date: "2026-07-01" }),
    ).rejects.toMatchObject({ statusCode: 422, code: "ODOMETER_REGRESSION" });
  });

  it("aceita leitura retroativa coerente com a série", async () => {
    (odometerReadingRepository.find as jest.Mock)
      .mockResolvedValueOnce([reading(70000, "2026-06-01")])
      .mockResolvedValueOnce([reading(78000, "2026-08-10")]);

    await expect(
      createOdometerReading(requester, String(vehicleId), { km: 74000, date: "2026-07-01" }),
    ).resolves.toMatchObject({ kmPerDay: 41 });
  });
});

describe("correctOdometerReading", () => {
  const original = reading(78000, "2026-08-10");

  beforeEach(() => {
    (odometerReadingRepository.findOne as jest.Mock).mockResolvedValue(original);
  });

  it("cria leitura de correção preservando a original", async () => {
    await correctOdometerReading(requester, String(vehicleId), String(original._id), {
      km: 77500,
    });

    const document = (odometerReadingRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(document.source).toBe("correction");
    expect(document.correctsId).toBe(original._id);
    expect(document.km).toBe(77500);
    expect(document.date).toEqual(original.date);
  });

  it("ignora a regra de monotonicidade", async () => {
    (odometerReadingRepository.find as jest.Mock).mockResolvedValue([
      reading(90000, "2026-08-15"),
    ]);

    await expect(
      correctOdometerReading(requester, String(vehicleId), String(original._id), { km: 1000 }),
    ).resolves.toBeDefined();
  });

  it("exige papel de gestão", async () => {
    await correctOdometerReading(requester, String(vehicleId), String(original._id), {
      km: 77500,
    });

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "manage");
  });

  it("recusa id malformado", async () => {
    await expect(
      correctOdometerReading(requester, String(vehicleId), "nao-e-id", { km: 1 }),
    ).rejects.toMatchObject({ statusCode: 404, code: "READING_NOT_FOUND" });
  });

  it("recusa leitura inexistente", async () => {
    (odometerReadingRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      correctOdometerReading(requester, String(vehicleId), String(original._id), { km: 1 }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("recusa corrigir uma correção", async () => {
    (odometerReadingRepository.findOne as jest.Mock).mockResolvedValue(
      reading(77500, "2026-08-10", "correction"),
    );

    await expect(
      correctOdometerReading(requester, String(vehicleId), String(original._id), { km: 1 }),
    ).rejects.toMatchObject({ statusCode: 409, code: "READING_ALREADY_CORRECTED" });
  });
});

describe("listOdometerReadings", () => {
  it("pagina por data decrescente e devolve cursor", async () => {
    (odometerReadingRepository.find as jest.Mock).mockResolvedValue([
      reading(79010, "2026-08-18"),
      reading(78000, "2026-08-10"),
      reading(77140, "2026-08-02"),
    ]);

    const result = await listOdometerReadings(requester, String(vehicleId), { limit: 2 });

    expect(result.readings).toHaveLength(2);
    expect(result.nextCursor).toBe(new Date("2026-08-10").toISOString());
    expect((odometerReadingRepository.find as jest.Mock).mock.calls[0][2]).toEqual({
      sort: { date: -1, createdAt: -1 },
      limit: 3,
    });
  });

  it("devolve cursor nulo na última página", async () => {
    (odometerReadingRepository.find as jest.Mock).mockResolvedValue([
      reading(79010, "2026-08-18"),
    ]);

    const result = await listOdometerReadings(requester, String(vehicleId), { limit: 2 });

    expect(result.nextCursor).toBeNull();
  });

  it("aplica o cursor recebido", async () => {
    await listOdometerReadings(requester, String(vehicleId), {
      before: "2026-08-10T00:00:00.000Z",
    });

    expect((odometerReadingRepository.find as jest.Mock).mock.calls[0][0]).toEqual({
      vehicleId,
      date: { $lt: new Date("2026-08-10T00:00:00.000Z") },
    });
  });
});
