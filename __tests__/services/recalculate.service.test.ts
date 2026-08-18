import { Types } from "mongoose";

jest.mock("../../src/repositories/odometerReading.repository", () => ({
  odometerReadingRepository: { find: jest.fn() },
}));
jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: { find: jest.fn(), bulkWrite: jest.fn() },
}));
jest.mock("../../src/repositories/vehicle.repository", () => ({
  vehicleRepository: { findById: jest.fn(), updateOne: jest.fn() },
}));

import { odometerReadingRepository } from "../../src/repositories/odometerReading.repository";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { vehicleRepository } from "../../src/repositories/vehicle.repository";
import {
  recalculateVehicle,
  recalculateVehicleById,
} from "../../src/services/plan/recalculate.service";
import { PlanItemDocument } from "../../src/types/plan-item";
import { VehicleDocument } from "../../src/types/vehicle";
import { addDays, today } from "../../src/utils/date";

const vehicleId = new Types.ObjectId();
const accountId = new Types.ObjectId();

const vehicle = {
  _id: vehicleId,
  accountId,
  currentOdometer: 70000,
  currentOdometerAt: addDays(today(), -60),
  kmPerDay: 33,
  healthScore: 100,
} as VehicleDocument;

const planItem = (overrides: Partial<PlanItemDocument> = {}): PlanItemDocument =>
  ({
    _id: new Types.ObjectId(),
    accountId,
    vehicleId,
    code: "ENGINE_OIL",
    name: "Óleo do motor + filtro",
    category: "engine",
    dueType: "both",
    criticality: "critical",
    intervalKm: 10000,
    intervalMonths: 12,
    leadTimeDays: 30,
    leadTimeKm: 1000,
    cycle: 0,
    status: "unknown",
    custom: false,
    customized: false,
    muted: false,
    active: true,
    calculatedAt: today(),
    ...overrides,
  }) as PlanItemDocument;

beforeEach(() => {
  (odometerReadingRepository.find as jest.Mock).mockResolvedValue([]);
  (planItemRepository.find as jest.Mock).mockResolvedValue([]);
});

describe("recalculateVehicle", () => {
  it("usa o fallback de 33 km/dia sem série suficiente", async () => {
    const result = await recalculateVehicle(vehicle);

    expect(result.kmPerDay).toBe(33);
    expect(result.reportedOdometer).toBe(70000);
    expect(result.estimatedOdometer).toBe(70000 + 33 * 60);
    expect(result.odometerConfidence).toBe("low");
    expect(result.daysSinceReading).toBe(60);
  });

  it("calcula km/dia pela série e projeta a partir da leitura mais nova", async () => {
    (odometerReadingRepository.find as jest.Mock).mockResolvedValue([
      { km: 78000, date: addDays(today(), -10) },
      { km: 74000, date: addDays(today(), -50) },
    ]);

    const result = await recalculateVehicle(vehicle);

    expect(result.kmPerDay).toBe(100);
    expect(result.reportedOdometer).toBe(78000);
    expect(result.estimatedOdometer).toBe(79000);
    expect(result.odometerConfidence).toBe("high");
  });

  it("marca item vencido por quilometragem e devolve a mudança de status", async () => {
    (odometerReadingRepository.find as jest.Mock).mockResolvedValue([
      { km: 85000, date: today() },
      { km: 80000, date: addDays(today(), -50) },
    ]);
    (planItemRepository.find as jest.Mock).mockResolvedValue([
      planItem({ status: "ok", lastServiceKm: 70000, lastServiceDate: addDays(today(), -30) }),
    ]);

    const result = await recalculateVehicle(vehicle);

    expect(result.changedItems).toHaveLength(1);
    expect(result.changedItems[0]).toMatchObject({
      code: "ENGINE_OIL",
      previousStatus: "ok",
      status: "overdue",
      dueReason: "km",
    });
    expect(result.summary).toEqual({ overdue: 1, dueSoon: 0, ok: 0, unknown: 0 });
    expect(result.healthScore).toBe(0);
  });

  it("mantém item sem histórico como unknown e fora do healthScore", async () => {
    (planItemRepository.find as jest.Mock).mockResolvedValue([planItem()]);

    const result = await recalculateVehicle(vehicle);

    expect(result.changedItems).toHaveLength(0);
    expect(result.summary.unknown).toBe(1);
    expect(result.healthScore).toBe(100);
  });

  it("grava status, vencimento e data de cálculo em lote", async () => {
    const item = planItem({ lastServiceKm: 69000, lastServiceDate: addDays(today(), -20) });
    (planItemRepository.find as jest.Mock).mockResolvedValue([item]);

    await recalculateVehicle(vehicle);

    const [operations] = (planItemRepository.bulkWrite as jest.Mock).mock.calls[0];
    expect(operations).toHaveLength(1);
    expect(operations[0].updateOne.filter).toEqual({ _id: item._id });
    expect(operations[0].updateOne.update.$set).toMatchObject({
      status: expect.any(String),
      calculatedAt: today(),
    });
  });

  it("não escreve em lote quando o veículo não tem plano", async () => {
    await recalculateVehicle(vehicle);

    expect(planItemRepository.bulkWrite).not.toHaveBeenCalled();
  });

  it("atualiza o cache do veículo com km/dia, saúde e última leitura", async () => {
    (odometerReadingRepository.find as jest.Mock).mockResolvedValue([
      { km: 78000, date: addDays(today(), -10) },
      { km: 74000, date: addDays(today(), -50) },
    ]);

    await recalculateVehicle(vehicle);

    const [filter, update] = (vehicleRepository.updateOne as jest.Mock).mock.calls[0];
    expect(filter).toEqual({ _id: vehicleId });
    expect(update.$set).toMatchObject({
      kmPerDay: 100,
      healthScore: 100,
      currentOdometer: 78000,
    });
  });

  it("repassa a sessão da transação para as duas escritas", async () => {
    const session = { id: "session" } as any;
    (planItemRepository.find as jest.Mock).mockResolvedValue([planItem()]);

    await recalculateVehicle(vehicle, session);

    expect((planItemRepository.bulkWrite as jest.Mock).mock.calls[0][1]).toEqual({ session });
    expect((vehicleRepository.updateOne as jest.Mock).mock.calls[0][2]).toEqual({ session });
  });

  it("ignora item desativado no resumo", async () => {
    (planItemRepository.find as jest.Mock).mockResolvedValue([
      planItem({ active: false }),
      planItem({ active: true }),
    ]);

    const result = await recalculateVehicle(vehicle);

    expect(result.summary.unknown).toBe(1);
  });
});

describe("recalculateVehicleById", () => {
  it("devolve null quando o veículo não existe", async () => {
    (vehicleRepository.findById as jest.Mock).mockResolvedValue(null);

    expect(await recalculateVehicleById(vehicleId)).toBeNull();
  });

  it("recalcula quando o veículo existe", async () => {
    (vehicleRepository.findById as jest.Mock).mockResolvedValue(vehicle);

    const result = await recalculateVehicleById(vehicleId);

    expect(result?.vehicleId).toBe(String(vehicleId));
  });
});
