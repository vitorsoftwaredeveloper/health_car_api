import { Types } from "mongoose";

jest.mock("../../src/repositories/catalogItem.repository", () => ({
  catalogItemRepository: {
    find: jest.fn(),
    insertOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

import { catalogItemRepository } from "../../src/repositories/catalogItem.repository";
import {
  createCatalogItem,
  listCatalogItems,
  updateCatalogItem,
} from "../../src/services/catalog/catalog.service";
import { CatalogItemDocument } from "../../src/types/catalog";
import { DUPLICATE_KEY_ERROR_CODE } from "../../src/utils/errors";

const validPayload = {
  code: "brake_fluid",
  name: "Fluido de freio",
  category: "brakes" as const,
  dueType: "time" as const,
  defaultIntervalMonths: 24,
  criticality: "critical" as const,
  whatItIs: "Fluido que transmite a força do pedal até as rodas.",
  whyItMatters: "Absorve água e ferve em frenagem forte.",
};

const stored = (overrides: Partial<CatalogItemDocument> = {}): CatalogItemDocument =>
  ({
    _id: new Types.ObjectId(),
    ...validPayload,
    code: "BRAKE_FLUID",
    active: true,
    ...overrides,
  }) as CatalogItemDocument;

beforeEach(() => {
  (catalogItemRepository.insertOne as jest.Mock).mockImplementation(
    async (data: any) => ({ toObject: () => ({ _id: new Types.ObjectId(), ...data }) }),
  );
  (catalogItemRepository.find as jest.Mock).mockResolvedValue([stored()]);
});

describe("listCatalogItems", () => {
  it("filtra por categoria e esconde inativos", async () => {
    await listCatalogItems({ category: "brakes" });

    expect((catalogItemRepository.find as jest.Mock).mock.calls[0][0]).toEqual({
      category: "brakes",
      active: true,
    });
  });

  it("inclui inativos quando pedido", async () => {
    await listCatalogItems({ includeInactive: true });

    expect((catalogItemRepository.find as jest.Mock).mock.calls[0][0]).toEqual({});
  });

  it("devolve a visão com padrões preenchidos", async () => {
    const [item] = await listCatalogItems({});

    expect(item.defaultIntervalKm).toBeNull();
    expect(item.bundledWith).toEqual([]);
    expect(item.appliesTo).toBeNull();
  });
});

describe("createCatalogItem", () => {
  it("sobe o código para caixa alta", async () => {
    const view = await createCatalogItem(validPayload);

    expect(view.code).toBe("BRAKE_FLUID");
    expect(view.active).toBe(true);
  });

  it("exige intervalo de km em item que vence por km", async () => {
    await expect(
      createCatalogItem({ ...validPayload, dueType: "km", defaultIntervalMonths: null }),
    ).rejects.toMatchObject({ statusCode: 422, code: "INTERVAL_KM_REQUIRED" });
  });

  it("exige intervalo de meses em item que vence por tempo", async () => {
    await expect(
      createCatalogItem({ ...validPayload, defaultIntervalMonths: null }),
    ).rejects.toMatchObject({ statusCode: 422, code: "INTERVAL_MONTHS_REQUIRED" });
  });

  it("exige os dois intervalos em item both", async () => {
    await expect(
      createCatalogItem({
        ...validPayload,
        dueType: "both",
        defaultIntervalKm: 10000,
        defaultIntervalMonths: null,
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "INTERVAL_MONTHS_REQUIRED" });
  });

  it("exige algum intervalo em item de inspeção", async () => {
    await expect(
      createCatalogItem({
        ...validPayload,
        dueType: "inspection",
        defaultIntervalMonths: null,
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "INSPECTION_INTERVAL_REQUIRED" });
  });

  it("barra código repetido", async () => {
    (catalogItemRepository.insertOne as jest.Mock).mockRejectedValue({
      code: DUPLICATE_KEY_ERROR_CODE,
    });

    await expect(createCatalogItem(validPayload)).rejects.toMatchObject({
      statusCode: 409,
      code: "CATALOG_CODE_ALREADY_EXISTS",
    });
  });
});

describe("updateCatalogItem", () => {
  it("atualiza o item existente", async () => {
    (catalogItemRepository.findOneAndUpdate as jest.Mock).mockImplementation(
      async (_filter: any, update: any) => stored(update.$set),
    );

    const view = await updateCatalogItem(String(new Types.ObjectId()), {
      ...validPayload,
      defaultIntervalMonths: 36,
    });

    expect(view.defaultIntervalMonths).toBe(36);
  });

  it("recusa id malformado com 404", async () => {
    await expect(
      updateCatalogItem("nao-e-id", validPayload),
    ).rejects.toMatchObject({ statusCode: 404, code: "CATALOG_ITEM_NOT_FOUND" });
  });

  it("recusa item inexistente com 404", async () => {
    (catalogItemRepository.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

    await expect(
      updateCatalogItem(String(new Types.ObjectId()), validPayload),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
