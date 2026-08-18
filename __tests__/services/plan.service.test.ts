import { Types } from "mongoose";

jest.mock("../../src/repositories/catalogItem.repository", () => ({
  catalogItemRepository: { find: jest.fn(), findOne: jest.fn() },
}));
jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: {
    find: jest.fn(),
    findOne: jest.fn(),
    insertOne: jest.fn(),
    insertMany: jest.fn(),
  },
}));
jest.mock("../../src/repositories/planTemplate.repository", () => ({
  planTemplateRepository: { find: jest.fn() },
}));
jest.mock("../../src/services/vehicles/access.service", () => ({
  assertVehicleAccess: jest.fn(),
}));

import { catalogItemRepository } from "../../src/repositories/catalogItem.repository";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { planTemplateRepository } from "../../src/repositories/planTemplate.repository";
import { assertVehicleAccess } from "../../src/services/vehicles/access.service";
import {
  addCatalogItemToPlan,
  applyTemplateToVehicle,
  getPlan,
} from "../../src/services/plan/plan.service";
import { CatalogItemDocument } from "../../src/types/catalog";
import { Requester } from "../../src/types/user";
import { VehicleDocument } from "../../src/types/vehicle";

const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();

const requester: Requester = {
  userId: new Types.ObjectId(),
  accountId,
  role: "owner",
  user: {} as any,
};

const vehicle = (overrides: Partial<VehicleDocument> = {}): VehicleDocument =>
  ({
    _id: vehicleId,
    accountId,
    fuel: "flex",
    transmission: "cvt",
    modelYear: 2020,
    ...overrides,
  }) as VehicleDocument;

const engineOilId = new Types.ObjectId();
const cvtFluidId = new Types.ObjectId();

const catalog: CatalogItemDocument[] = [
  {
    _id: engineOilId,
    code: "ENGINE_OIL",
    name: "Óleo do motor + filtro",
    category: "engine",
    dueType: "both",
    defaultIntervalKm: 10000,
    defaultIntervalMonths: 12,
    criticality: "critical",
    active: true,
  } as CatalogItemDocument,
  {
    _id: cvtFluidId,
    code: "CVT_FLUID",
    name: "Fluido do câmbio CVT",
    category: "transmission",
    dueType: "both",
    defaultIntervalKm: 40000,
    defaultIntervalMonths: 48,
    criticality: "high",
    appliesTo: { transmission: ["cvt"] },
    active: true,
  } as CatalogItemDocument,
];

const template = {
  name: "Genérico",
  criteria: {},
  priority: 0,
  active: true,
  items: [
    { catalogItemCode: "ENGINE_OIL", activeByDefault: true },
    { catalogItemCode: "CVT_FLUID", activeByDefault: true },
  ],
};

beforeEach(() => {
  (planTemplateRepository.find as jest.Mock).mockResolvedValue([template]);
  (catalogItemRepository.find as jest.Mock).mockResolvedValue(catalog);
  (planItemRepository.find as jest.Mock).mockResolvedValue([]);
  (planItemRepository.insertMany as jest.Mock).mockResolvedValue([]);
  (assertVehicleAccess as jest.Mock).mockResolvedValue(vehicle());
});

describe("applyTemplateToVehicle", () => {
  it("cria um item por peça aplicável", async () => {
    const result = await applyTemplateToVehicle(vehicle());

    const documents = (planItemRepository.insertMany as jest.Mock).mock.calls[0][0];
    expect(result).toEqual({ templateName: "Genérico", created: 2, skipped: 0 });
    expect(documents.map((item: any) => item.code)).toEqual(["ENGINE_OIL", "CVT_FLUID"]);
    expect(documents[0].vehicleId).toBe(vehicleId);
    expect(documents[0].accountId).toBe(accountId);
    expect(documents[0].status).toBe("unknown");
    expect(documents[0].cycle).toBe(0);
  });

  it("pula peça que não serve para o câmbio do carro", async () => {
    const result = await applyTemplateToVehicle(vehicle({ transmission: "manual" }));

    const documents = (planItemRepository.insertMany as jest.Mock).mock.calls[0][0];
    expect(documents.map((item: any) => item.code)).toEqual(["ENGINE_OIL"]);
    expect(result).toEqual({ templateName: "Genérico", created: 1, skipped: 1 });
  });

  it("não sobrescreve item que já está no plano", async () => {
    (planItemRepository.find as jest.Mock).mockResolvedValue([
      { catalogItemId: engineOilId },
    ]);

    const result = await applyTemplateToVehicle(vehicle());

    const documents = (planItemRepository.insertMany as jest.Mock).mock.calls[0][0];
    expect(documents.map((item: any) => item.code)).toEqual(["CVT_FLUID"]);
    expect(result.skipped).toBe(1);
  });

  it("não grava nada quando nenhum item sobra", async () => {
    (planItemRepository.find as jest.Mock).mockResolvedValue([
      { catalogItemId: engineOilId },
      { catalogItemId: cvtFluidId },
    ]);

    const result = await applyTemplateToVehicle(vehicle());

    expect(planItemRepository.insertMany).not.toHaveBeenCalled();
    expect(result).toEqual({ templateName: "Genérico", created: 0, skipped: 2 });
  });

  it("aplica override de intervalo do template", async () => {
    (planTemplateRepository.find as jest.Mock).mockResolvedValue([
      {
        ...template,
        items: [
          {
            catalogItemCode: "ENGINE_OIL",
            intervalKm: 5000,
            intervalMonths: 6,
            activeByDefault: false,
          },
        ],
      },
    ]);
    (catalogItemRepository.find as jest.Mock).mockResolvedValue([catalog[0]]);

    await applyTemplateToVehicle(vehicle());

    const [document] = (planItemRepository.insertMany as jest.Mock).mock.calls[0][0];
    expect(document.intervalKm).toBe(5000);
    expect(document.intervalMonths).toBe(6);
    expect(document.leadTimeKm).toBe(500);
    expect(document.active).toBe(false);
  });

  it("não faz nada quando nenhum template casa com o carro", async () => {
    (planTemplateRepository.find as jest.Mock).mockResolvedValue([
      { ...template, criteria: { fuel: ["diesel"] } },
    ]);

    const result = await applyTemplateToVehicle(vehicle());

    expect(result).toEqual({ templateName: null, created: 0, skipped: 0 });
    expect(planItemRepository.insertMany).not.toHaveBeenCalled();
  });

  it("passa a sessão da transação para a gravação", async () => {
    const session = { id: "session" } as any;

    await applyTemplateToVehicle(vehicle(), session);

    expect((planItemRepository.insertMany as jest.Mock).mock.calls[0][1]).toEqual({
      session,
    });
  });
});

describe("addCatalogItemToPlan", () => {
  beforeEach(() => {
    (catalogItemRepository.findOne as jest.Mock).mockResolvedValue(catalog[0]);
    (planItemRepository.findOne as jest.Mock).mockResolvedValue(null);
    (planItemRepository.insertOne as jest.Mock).mockImplementation(
      async (data: any) => ({ toObject: () => data }),
    );
  });

  it("normaliza o código e grava o item", async () => {
    const view = await addCatalogItemToPlan(requester, String(vehicleId), {
      catalogItemCode: "engine_oil",
    });

    expect((catalogItemRepository.findOne as jest.Mock).mock.calls[0][0]).toEqual({
      code: "ENGINE_OIL",
      active: true,
    });
    expect(view.code).toBe("ENGINE_OIL");
    expect(view.customized).toBe(false);
    expect(view.status).toBe("unknown");
  });

  it("marca personalizado quando o intervalo difere do catálogo", async () => {
    const view = await addCatalogItemToPlan(requester, String(vehicleId), {
      catalogItemCode: "ENGINE_OIL",
      intervalKm: 7500,
    });

    expect(view.customized).toBe(true);
    expect(view.intervalKm).toBe(7500);
  });

  it("guarda a última troca informada", async () => {
    const view = await addCatalogItemToPlan(requester, String(vehicleId), {
      catalogItemCode: "ENGINE_OIL",
      lastServiceKm: 62000,
      lastServiceDate: "2025-05-09",
    });

    expect(view.lastServiceKm).toBe(62000);
    expect(view.lastServiceDate).toEqual(new Date("2025-05-09"));
  });

  it("recusa código inexistente", async () => {
    (catalogItemRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      addCatalogItemToPlan(requester, String(vehicleId), { catalogItemCode: "NAO_EXISTE" }),
    ).rejects.toMatchObject({ statusCode: 404, code: "CATALOG_ITEM_NOT_FOUND" });
  });

  it("recusa item já presente no plano", async () => {
    (planItemRepository.findOne as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId() });

    await expect(
      addCatalogItemToPlan(requester, String(vehicleId), { catalogItemCode: "ENGINE_OIL" }),
    ).rejects.toMatchObject({ statusCode: 409, code: "PLAN_ITEM_ALREADY_EXISTS" });
  });

  it("exige papel de gestão do veículo", async () => {
    await addCatalogItemToPlan(requester, String(vehicleId), {
      catalogItemCode: "ENGINE_OIL",
    });

    expect(assertVehicleAccess).toHaveBeenCalledWith(
      requester,
      String(vehicleId),
      "manage",
    );
  });
});

describe("getPlan", () => {
  it("lê o plano com acesso de leitura e ordena por categoria", async () => {
    (planItemRepository.find as jest.Mock).mockResolvedValue([
      { _id: new Types.ObjectId(), code: "ENGINE_OIL", name: "Óleo", category: "engine", status: "unknown", cycle: 0, custom: false, customized: false, criticality: "critical", dueType: "both", leadTimeDays: 30, leadTimeKm: 1000, muted: false, active: true },
    ]);

    const plan = await getPlan(requester, String(vehicleId));

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "read");
    expect((planItemRepository.find as jest.Mock).mock.calls[0][2]).toEqual({
      sort: { category: 1, name: 1 },
    });
    expect(plan[0].code).toBe("ENGINE_OIL");
  });
});
