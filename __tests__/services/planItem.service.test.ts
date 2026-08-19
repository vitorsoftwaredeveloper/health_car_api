import { Types } from "mongoose";

jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: { findOne: jest.fn(), updateOne: jest.fn(), insertOne: jest.fn() },
}));
jest.mock("../../src/services/vehicles/access.service", () => ({
  assertVehicleAccess: jest.fn(),
}));
jest.mock("../../src/services/plan/recalculate.service", () => ({
  recalculateVehicle: jest.fn(),
}));

import { planItemRepository } from "../../src/repositories/planItem.repository";
import { assertVehicleAccess } from "../../src/services/vehicles/access.service";
import { recalculateVehicle } from "../../src/services/plan/recalculate.service";
import {
  createCustomPlanItem,
  deactivatePlanItem,
  mutePlanItem,
  updatePlanItem,
} from "../../src/services/plan/planItem.service";
import { PlanItemDocument } from "../../src/types/plan-item";
import { Requester } from "../../src/types/user";
import { VehicleDocument } from "../../src/types/vehicle";
import { parseLocalDate } from "../../src/utils/date";

const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const planItemId = new Types.ObjectId();

const requester: Requester = {
  userId: new Types.ObjectId(),
  accountId,
  role: "owner",
  user: {} as any,
};
const vehicle = { _id: vehicleId, accountId } as VehicleDocument;

const item = (overrides: Partial<PlanItemDocument> = {}): PlanItemDocument =>
  ({
    _id: planItemId,
    vehicleId,
    accountId,
    code: "SPARK_PLUGS",
    name: "Velas de ignição",
    category: "engine",
    dueType: "both",
    criticality: "high",
    intervalKm: 40000,
    intervalMonths: 36,
    customized: false,
    cycle: 0,
    status: "ok",
    leadTimeDays: 30,
    leadTimeKm: 4000,
    muted: false,
    active: true,
    custom: false,
    calculatedAt: new Date(),
    ...overrides,
  }) as PlanItemDocument;

beforeEach(() => {
  (assertVehicleAccess as jest.Mock).mockResolvedValue(vehicle);
  (planItemRepository.findOne as jest.Mock).mockResolvedValue(item());
  (planItemRepository.insertOne as jest.Mock).mockResolvedValue({});
  (recalculateVehicle as jest.Mock).mockImplementation(async () => ({
    healthScore: 74,
    items: [item({ status: "due_soon" })],
  }));
});

describe("updatePlanItem", () => {
  it("aplica override e marca o item como personalizado", async () => {
    const result = await updatePlanItem(requester, String(vehicleId), String(planItemId), {
      intervalKm: 100000,
      intervalMonths: 60,
      leadTimeKm: 2000,
      note: "Vela de irídio NGK",
    });

    const update = (planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update).toMatchObject({
      intervalKm: 100000,
      intervalMonths: 60,
      leadTimeKm: 2000,
      customized: true,
      note: "Vela de irídio NGK",
    });
    expect(result.item.status).toBe("due_soon");
    expect(result.healthScore).toBe(74);
  });

  it("informa a última troca de item unknown", async () => {
    await updatePlanItem(requester, String(vehicleId), String(planItemId), {
      lastServiceKm: 45000,
      lastServiceDate: "2023-11-20",
    });

    const update = (planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update.lastServiceKm).toBe(45000);
    expect(update.lastServiceDate).toEqual(parseLocalDate("2023-11-20"));
  });

  it("limpa a última troca quando recebe null", async () => {
    await updatePlanItem(requester, String(vehicleId), String(planItemId), {
      lastServiceDate: null,
    });

    expect(
      (planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set.lastServiceDate,
    ).toBeNull();
  });

  it("reativa item desativado", async () => {
    await updatePlanItem(requester, String(vehicleId), String(planItemId), { active: true });

    expect((planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set.active).toBe(true);
  });

  it("recusa tirar o intervalo de km de item que vence por km", async () => {
    await expect(
      updatePlanItem(requester, String(vehicleId), String(planItemId), { intervalKm: null }),
    ).rejects.toMatchObject({ statusCode: 422, code: "INTERVAL_KM_REQUIRED" });
  });

  it("recusa tirar o intervalo de meses de item que vence por tempo", async () => {
    await expect(
      updatePlanItem(requester, String(vehicleId), String(planItemId), {
        intervalMonths: null,
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "INTERVAL_MONTHS_REQUIRED" });
  });

  it("recusa item de inspeção sem nenhum intervalo", async () => {
    (planItemRepository.findOne as jest.Mock).mockResolvedValue(
      item({ dueType: "inspection", intervalMonths: null }),
    );

    await expect(
      updatePlanItem(requester, String(vehicleId), String(planItemId), { intervalKm: null }),
    ).rejects.toMatchObject({ statusCode: 422, code: "INSPECTION_INTERVAL_REQUIRED" });
  });

  it("recusa item de outro veículo", async () => {
    (planItemRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      updatePlanItem(requester, String(vehicleId), String(planItemId), { intervalKm: 50000 }),
    ).rejects.toMatchObject({ statusCode: 404, code: "PLAN_ITEM_NOT_FOUND" });
  });

  it("recusa id malformado", async () => {
    await expect(
      updatePlanItem(requester, String(vehicleId), "nao-e-id", {}),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("exige papel de gestão", async () => {
    await updatePlanItem(requester, String(vehicleId), String(planItemId), {});

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "manage");
  });
});

describe("mutePlanItem", () => {
  it("silencia sem parar de calcular", async () => {
    const result = await mutePlanItem(requester, String(vehicleId), String(planItemId), {
      muted: true,
    });

    expect((planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set).toEqual({
      muted: true,
    });
    expect(result.item.status).toBe("due_soon");
  });

  it("volta a avisar", async () => {
    await mutePlanItem(requester, String(vehicleId), String(planItemId), { muted: false });

    expect((planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set.muted).toBe(false);
  });
});

describe("deactivatePlanItem", () => {
  it("desativa sem apagar", async () => {
    await deactivatePlanItem(requester, String(vehicleId), String(planItemId));

    expect((planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set).toEqual({
      active: false,
    });
  });
});

describe("createCustomPlanItem", () => {
  const payload = {
    name: "  Coxim do câmbio  ",
    category: "transmission" as const,
    dueType: "both" as const,
    intervalKm: 60000,
    intervalMonths: 48,
    lastServiceKm: 50000,
    lastServiceDate: "2025-03-10",
  };

  beforeEach(() => {
    (planItemRepository.findOne as jest.Mock).mockResolvedValue(null);
    (recalculateVehicle as jest.Mock).mockImplementation(async () => {
      const inserted = (planItemRepository.insertOne as jest.Mock).mock.calls[0]?.[0];
      return {
        healthScore: 80,
        items: [
          item({
            _id: inserted?._id,
            custom: true,
            code: null,
            name: "Coxim do câmbio",
          }),
        ],
      };
    });
  });

  it("nasce custom, sem código de catálogo e já personalizado", async () => {
    const result = await createCustomPlanItem(requester, String(vehicleId), payload);

    const document = (planItemRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(document).toMatchObject({
      custom: true,
      catalogItemId: null,
      code: null,
      name: "Coxim do câmbio",
      criticality: "medium",
      customized: true,
      cycle: 0,
      status: "unknown",
      active: true,
    });
    expect(document.leadTimeKm).toBe(6000);
    expect(document.lastServiceDate).toEqual(parseLocalDate("2025-03-10"));
    expect(result.item.custom).toBe(true);
    expect(result.duplicateName).toBe(false);
  });

  it("aceita criticidade escolhida pelo usuário", async () => {
    await createCustomPlanItem(requester, String(vehicleId), {
      ...payload,
      criticality: "critical",
    });

    expect(
      (planItemRepository.insertOne as jest.Mock).mock.calls[0][0].criticality,
    ).toBe("critical");
  });

  it("apenas avisa quando o nome já existe no plano", async () => {
    (planItemRepository.findOne as jest.Mock).mockResolvedValue({ _id: planItemId });

    const result = await createCustomPlanItem(requester, String(vehicleId), payload);

    expect(result.duplicateName).toBe(true);
    expect(planItemRepository.insertOne).toHaveBeenCalled();
  });

  it("recusa peça sem o intervalo do tipo de vencimento", async () => {
    await expect(
      createCustomPlanItem(requester, String(vehicleId), {
        ...payload,
        intervalMonths: null,
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "INTERVAL_MONTHS_REQUIRED" });
  });

  it("exige papel de gestão", async () => {
    await createCustomPlanItem(requester, String(vehicleId), payload);

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "manage");
  });
});
