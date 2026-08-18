import { Types } from "mongoose";

jest.mock("../../src/services/vehicles/access.service", () => ({
  assertVehicleAccess: jest.fn(),
}));
jest.mock("../../src/services/plan/recalculate.service", () => ({
  recalculateVehicle: jest.fn(),
}));

import { assertVehicleAccess } from "../../src/services/vehicles/access.service";
import { recalculateVehicle } from "../../src/services/plan/recalculate.service";
import { getVehicleHealth } from "../../src/services/vehicles/health.service";
import { Requester } from "../../src/types/user";
import { VehicleDocument } from "../../src/types/vehicle";

const vehicleId = new Types.ObjectId();
const requester: Requester = {
  userId: new Types.ObjectId(),
  accountId: new Types.ObjectId(),
  role: "owner",
  user: {} as any,
};

const vehicle = { _id: vehicleId, nickname: "Meu Civic" } as VehicleDocument;

const evaluation = (
  name: string,
  status: any,
  dueDate: Date | null,
  extras: any = {},
) => ({
  item: {
    _id: new Types.ObjectId(),
    code: name,
    name,
    category: "engine",
    criticality: extras.criticality ?? "medium",
    dueType: "both",
    status,
    dueDate,
    custom: false,
    muted: false,
    active: extras.active ?? true,
    lastServiceKm: extras.lastServiceKm ?? null,
    lastServiceDate: extras.lastServiceDate ?? null,
  },
  result: {
    status,
    dueDate,
    dueReason: extras.dueReason ?? "km",
    nextDueKm: extras.nextDueKm ?? null,
    nextDueDate: null,
    kmRemaining: extras.kmRemaining ?? null,
    daysRemaining: extras.daysRemaining ?? null,
  },
});

beforeEach(() => {
  (assertVehicleAccess as jest.Mock).mockResolvedValue(vehicle);
  (recalculateVehicle as jest.Mock).mockResolvedValue({
    kmPerDay: 33,
    estimatedOdometer: 77668,
    reportedOdometer: 77140,
    reportedOdometerAt: new Date("2026-08-02"),
    daysSinceReading: 16,
    odometerConfidence: "medium",
    healthScore: 67,
    summary: { overdue: 1, dueSoon: 1, ok: 1, unknown: 1 },
    items: [],
    evaluations: [
      evaluation("OK_ITEM", "ok", new Date("2027-01-01"), { kmRemaining: 5400 }),
      evaluation("UNKNOWN_ITEM", "unknown", null),
      evaluation("OVERDUE_ITEM", "overdue", new Date("2026-05-09"), {
        dueReason: "time",
        daysRemaining: -101,
        criticality: "critical",
      }),
      evaluation("DUE_SOON_ITEM", "due_soon", new Date("2026-09-01"), { kmRemaining: 480 }),
      evaluation("HIDDEN_ITEM", "overdue", new Date("2026-01-01"), { active: false }),
    ],
    changedItems: [],
  });
});

describe("getVehicleHealth", () => {
  it("exige apenas acesso de leitura", async () => {
    await getVehicleHealth(requester, String(vehicleId));

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "read");
  });

  it("devolve o painel do veículo com a confiança do odômetro", async () => {
    const view = await getVehicleHealth(requester, String(vehicleId));

    expect(view.vehicle).toMatchObject({
      id: String(vehicleId),
      nickname: "Meu Civic",
      estimatedOdometer: 77668,
      reportedOdometer: 77140,
      kmPerDay: 33,
      odometerConfidence: "medium",
      daysSinceReading: 16,
    });
    expect(view.healthScore).toBe(67);
    expect(view.healthBand).toBe("warning");
    expect(view.summary).toEqual({ overdue: 1, dueSoon: 1, ok: 1, unknown: 1 });
  });

  it("ordena por urgência e esconde item desativado", async () => {
    const view = await getVehicleHealth(requester, String(vehicleId));

    expect(view.items.map((item) => item.code)).toEqual([
      "OVERDUE_ITEM",
      "DUE_SOON_ITEM",
      "OK_ITEM",
      "UNKNOWN_ITEM",
    ]);
  });

  it("traz a frase pronta para a tela", async () => {
    const view = await getVehicleHealth(requester, String(vehicleId));
    const byCode = Object.fromEntries(view.items.map((item) => [item.code, item.message]));

    expect(byCode.OVERDUE_ITEM).toBe("Vencido há 101 dias, por tempo.");
    expect(byCode.DUE_SOON_ITEM).toBe("Vence em 480 km, por quilometragem.");
    expect(byCode.OK_ITEM).toBe("Em dia. Vence em 5.400 km.");
    expect(byCode.UNKNOWN_ITEM).toBe(
      "Sem histórico. Informe a última troca para começar a acompanhar.",
    );
  });

  it("expõe a folga em km e em dias de cada item", async () => {
    const view = await getVehicleHealth(requester, String(vehicleId));
    const overdue = view.items.find((item) => item.code === "OVERDUE_ITEM");

    expect(overdue).toMatchObject({
      daysRemaining: -101,
      dueReason: "time",
      criticality: "critical",
    });
  });

  it("classifica a faixa do anel de saúde", async () => {
    (recalculateVehicle as jest.Mock).mockResolvedValue({
      kmPerDay: 33,
      estimatedOdometer: 1,
      reportedOdometer: 1,
      reportedOdometerAt: new Date(),
      daysSinceReading: 0,
      odometerConfidence: "high",
      healthScore: 92,
      summary: { overdue: 0, dueSoon: 0, ok: 1, unknown: 0 },
      items: [],
      evaluations: [],
      changedItems: [],
    });

    expect((await getVehicleHealth(requester, String(vehicleId))).healthBand).toBe("good");
  });
});
