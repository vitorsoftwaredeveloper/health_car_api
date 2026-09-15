import { Types } from "mongoose";

jest.mock("../../src/repositories/fuelEntry.repository", () => ({
  fuelEntryRepository: {
    find: jest.fn(),
    findOne: jest.fn(),
    insertOne: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
jest.mock("../../src/repositories/odometerReading.repository", () => ({
  odometerReadingRepository: {
    find: jest.fn(),
    insertOne: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
jest.mock("../../src/services/vehicles/access.service", () => ({
  assertVehicleAccess: jest.fn(),
}));
jest.mock("../../src/libs/mongo", () => ({
  withTransaction: jest.fn((operation: any) => operation({ id: "session" })),
}));
jest.mock("../../src/services/plan/recalculate.service", () => ({
  recalculateVehicle: jest.fn(async () => ({
    kmPerDay: 38,
    estimatedOdometer: 80200,
    healthScore: 72,
    changedItems: [],
  })),
}));

import { fuelEntryRepository } from "../../src/repositories/fuelEntry.repository";
import { odometerReadingRepository } from "../../src/repositories/odometerReading.repository";
import { assertVehicleAccess } from "../../src/services/vehicles/access.service";
import { recalculateVehicle } from "../../src/services/plan/recalculate.service";
import {
  createFuelEntry,
  deleteFuelEntry,
  listFuelEntries,
} from "../../src/services/fuel/fuel.service";
import { Requester } from "../../src/types/user";
import { VehicleDocument } from "../../src/types/vehicle";

const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const userId = new Types.ObjectId();

const requester: Requester = { userId, accountId, role: "owner", user: {} as any };

const vehicle = {
  _id: vehicleId,
  accountId,
  fuel: "flex",
  currentOdometer: 79000,
  currentOdometerAt: new Date("2026-08-02"),
} as VehicleDocument;

const entry = (
  odometerKm: number,
  date: string,
  liters = 40,
  overrides: Record<string, unknown> = {},
) => ({
  _id: new Types.ObjectId(),
  accountId,
  vehicleId,
  date: new Date(date),
  odometerKm,
  liters,
  fuelKind: "gasoline",
  totalCents: null,
  fullTank: true,
  odometerReadingId: new Types.ObjectId(),
  createdBy: userId,
  createdAt: new Date(date),
  ...overrides,
});

let stored: any[] = [];

beforeEach(() => {
  stored = [];
  (assertVehicleAccess as jest.Mock).mockResolvedValue(vehicle);
  (odometerReadingRepository.find as jest.Mock).mockResolvedValue([]);
  (odometerReadingRepository.insertOne as jest.Mock).mockImplementation(
    async (data: any) => ({ toObject: () => data }),
  );
  (fuelEntryRepository.insertOne as jest.Mock).mockImplementation(
    async (data: any) => {
      stored.push(data);
      return { toObject: () => data };
    },
  );
  (fuelEntryRepository.find as jest.Mock).mockImplementation(async () =>
    [...stored].sort((a, b) => b.date.getTime() - a.date.getTime()),
  );
});

describe("createFuelEntry", () => {
  it("grava abastecimento e leitura de odômetro na mesma transação", async () => {
    const result = await createFuelEntry(requester, String(vehicleId), {
      odometerKm: 79500,
      liters: 42.5,
      fuelKind: "ethanol",
      totalCents: 17000,
      date: "2026-08-20",
    });

    const reading = (odometerReadingRepository.insertOne as jest.Mock).mock.calls[0];
    expect(reading[0]).toMatchObject({ km: 79500, source: "refuel", accountId });
    expect(reading[1]).toEqual({ session: { id: "session" } });

    const saved = (fuelEntryRepository.insertOne as jest.Mock).mock.calls[0];
    expect(saved[0]).toMatchObject({
      liters: 42.5,
      fuelKind: "ethanol",
      totalCents: 17000,
      fullTank: true,
      odometerReadingId: reading[0]._id,
    });
    expect(reading[0].referenceId).toEqual(saved[0]._id);
    expect(saved[1]).toEqual({ session: { id: "session" } });

    expect(recalculateVehicle).toHaveBeenCalledWith(vehicle);
    expect(result.odometer.kmPerDay).toBe(38);
    expect(result.entry.kmPerLiter).toBeNull();
    expect(result.entry.pricePerLiterCents).toBe(400);
    expect(result.summary.fills).toBe(1);
  });

  it("mede o consumo contra o tanque cheio anterior", async () => {
    stored.push(entry(79000, "2026-08-01"));

    const result = await createFuelEntry(requester, String(vehicleId), {
      odometerKm: 79500,
      liters: 40,
      fuelKind: "gasoline",
      date: "2026-08-20",
    });

    expect(result.entry.kmPerLiter).toBe(12.5);
    expect(result.summary.averageKmPerLiter).toBe(12.5);
    expect(result.summary.measuredFills).toBe(1);
  });

  it("exige acesso de escrita", async () => {
    await createFuelEntry(requester, String(vehicleId), {
      odometerKm: 79500,
      liters: 40,
      fuelKind: "gasoline",
    });

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "write");
  });

  it("recusa combustível que o carro não usa", async () => {
    await expect(
      createFuelEntry(requester, String(vehicleId), {
        odometerKm: 79500,
        liters: 40,
        fuelKind: "diesel",
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "FUEL_KIND_NOT_APPLICABLE",
      details: { allowed: ["gasoline", "ethanol"] },
    });
    expect(fuelEntryRepository.insertOne).not.toHaveBeenCalled();
  });

  it("carro elétrico não abastece", async () => {
    (assertVehicleAccess as jest.Mock).mockResolvedValue({ ...vehicle, fuel: "electric" });

    await expect(
      createFuelEntry(requester, String(vehicleId), {
        odometerKm: 79500,
        liters: 40,
        fuelKind: "gasoline",
      }),
    ).rejects.toMatchObject({ statusCode: 422, message: "Este veículo não abastece combustível." });
  });

  it("recusa odômetro menor que a leitura anterior", async () => {
    (odometerReadingRepository.find as jest.Mock).mockResolvedValueOnce([
      { km: 80000, date: new Date("2026-08-10") },
    ]);

    await expect(
      createFuelEntry(requester, String(vehicleId), {
        odometerKm: 79500,
        liters: 40,
        fuelKind: "gasoline",
        date: "2026-08-20",
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "ODOMETER_REGRESSION" });
  });

  it("recusa data no futuro", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);

    await expect(
      createFuelEntry(requester, String(vehicleId), {
        odometerKm: 79500,
        liters: 40,
        fuelKind: "gasoline",
        date: future.toISOString().slice(0, 10),
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "FUTURE_DATE" });
  });
});

describe("listFuelEntries", () => {
  it("devolve página com métricas e resumo da série", async () => {
    stored.push(
      entry(79000, "2026-08-01"),
      entry(79500, "2026-08-10", 40, { totalCents: 24000 }),
      entry(80100, "2026-08-20", 40, { totalCents: 24000 }),
    );

    const result = await listFuelEntries(requester, String(vehicleId), {});

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "read");
    expect(result.entries.map((item) => item.kmPerLiter)).toEqual([15, 12.5, null]);
    expect(result.summary.averageKmPerLiter).toBe(13.75);
    expect(result.summary.costPerKmCents).toBe(44);
    expect(result.nextCursor).toBeNull();
  });

  it("pagina com cursor pela data", async () => {
    stored.push(entry(79000, "2026-08-01"), entry(79500, "2026-08-10"), entry(80100, "2026-08-20"));

    const result = await listFuelEntries(requester, String(vehicleId), { limit: 2 });

    expect(result.entries).toHaveLength(2);
    expect(result.nextCursor).toBe(new Date("2026-08-10").toISOString());
  });
});

describe("deleteFuelEntry", () => {
  it("apaga o abastecimento e a leitura que ele criou, depois recalcula", async () => {
    const target = entry(79500, "2026-08-10");
    (fuelEntryRepository.findOne as jest.Mock).mockResolvedValue(target);

    const result = await deleteFuelEntry(requester, String(vehicleId), String(target._id));

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "manage");
    expect(fuelEntryRepository.deleteOne).toHaveBeenCalledWith(
      { _id: target._id },
      { session: { id: "session" } },
    );
    expect(odometerReadingRepository.deleteOne).toHaveBeenCalledWith(
      { _id: target.odometerReadingId, source: "refuel" },
      { session: { id: "session" } },
    );
    expect(recalculateVehicle).toHaveBeenCalledWith(vehicle);
    expect(result.summary.fills).toBe(0);
  });

  it("abastecimento sem leitura vinculada só apaga a si mesmo", async () => {
    const target = entry(79500, "2026-08-10", 40, { odometerReadingId: null });
    (fuelEntryRepository.findOne as jest.Mock).mockResolvedValue(target);

    await deleteFuelEntry(requester, String(vehicleId), String(target._id));

    expect(odometerReadingRepository.deleteOne).not.toHaveBeenCalled();
  });

  it("id inválido ou de outro veículo é 404", async () => {
    await expect(
      deleteFuelEntry(requester, String(vehicleId), "nope"),
    ).rejects.toMatchObject({ statusCode: 404, code: "FUEL_ENTRY_NOT_FOUND" });

    (fuelEntryRepository.findOne as jest.Mock).mockResolvedValue(null);
    await expect(
      deleteFuelEntry(requester, String(vehicleId), String(new Types.ObjectId())),
    ).rejects.toMatchObject({ statusCode: 404, code: "FUEL_ENTRY_NOT_FOUND" });
  });
});
