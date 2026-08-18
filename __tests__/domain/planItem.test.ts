import {
  ACTIVE_BY_DEFAULT_CRITICALITIES,
  appliesToVehicle,
  buildPlanItemDraft,
} from "../../src/domain/planItem";
import { CatalogItemDocument } from "../../src/types/catalog";

const catalogItem = (
  overrides: Partial<CatalogItemDocument> = {},
): CatalogItemDocument =>
  ({
    code: "ENGINE_OIL",
    name: "Óleo do motor + filtro",
    category: "engine",
    dueType: "both",
    defaultIntervalKm: 10000,
    defaultIntervalMonths: 12,
    criticality: "critical",
    whatItIs: "x",
    whyItMatters: "y",
    active: true,
    ...overrides,
  }) as CatalogItemDocument;

describe("appliesToVehicle", () => {
  it("aceita item sem restrição", () => {
    expect(appliesToVehicle(catalogItem(), { fuel: "diesel" })).toBe(true);
  });

  it("respeita restrição de combustível", () => {
    const item = catalogItem({ appliesTo: { fuel: ["flex", "gasoline"] } });

    expect(appliesToVehicle(item, { fuel: "flex" })).toBe(true);
    expect(appliesToVehicle(item, { fuel: "diesel" })).toBe(false);
  });

  it("respeita restrição de câmbio", () => {
    const item = catalogItem({ appliesTo: { transmission: ["cvt"] } });

    expect(appliesToVehicle(item, { fuel: "flex", transmission: "cvt" })).toBe(true);
    expect(appliesToVehicle(item, { fuel: "flex", transmission: "manual" })).toBe(false);
  });

  it("descarta item de câmbio específico quando o câmbio é desconhecido", () => {
    const item = catalogItem({ appliesTo: { transmission: ["manual"] } });

    expect(appliesToVehicle(item, { fuel: "flex" })).toBe(false);
    expect(appliesToVehicle(item, { fuel: "flex", transmission: null })).toBe(false);
  });

  it("ignora listas vazias e nota livre", () => {
    const item = catalogItem({
      appliesTo: { fuel: [], transmission: [], note: "só informativo" },
    });

    expect(appliesToVehicle(item, { fuel: "electric" })).toBe(true);
  });
});

describe("buildPlanItemDraft", () => {
  it("herda intervalo e criticidade do catálogo", () => {
    const draft = buildPlanItemDraft(catalogItem());

    expect(draft.intervalKm).toBe(10000);
    expect(draft.intervalMonths).toBe(12);
    expect(draft.leadTimeDays).toBe(30);
    expect(draft.leadTimeKm).toBe(1000);
    expect(draft.status).toBe("unknown");
    expect(draft.cycle).toBe(0);
    expect(draft.custom).toBe(false);
    expect(draft.customized).toBe(false);
  });

  it("ativa por padrão só critical e high", () => {
    expect(buildPlanItemDraft(catalogItem({ criticality: "critical" })).active).toBe(true);
    expect(buildPlanItemDraft(catalogItem({ criticality: "high" })).active).toBe(true);
    expect(buildPlanItemDraft(catalogItem({ criticality: "medium" })).active).toBe(false);
    expect(buildPlanItemDraft(catalogItem({ criticality: "low" })).active).toBe(false);
    expect(ACTIVE_BY_DEFAULT_CRITICALITIES).toEqual(["critical", "high"]);
  });

  it("aplica override do template", () => {
    const draft = buildPlanItemDraft(catalogItem(), {
      intervalKm: 15000,
      intervalMonths: 24,
      activeByDefault: false,
    });

    expect(draft.intervalKm).toBe(15000);
    expect(draft.intervalMonths).toBe(24);
    expect(draft.leadTimeKm).toBe(1500);
    expect(draft.active).toBe(false);
  });

  it("usa lead time mínimo de 500 km em intervalo curto", () => {
    const draft = buildPlanItemDraft(
      catalogItem({ dueType: "km", defaultIntervalKm: 3000, defaultIntervalMonths: null }),
    );

    expect(draft.leadTimeKm).toBe(500);
    expect(draft.intervalMonths).toBeNull();
  });

  it("mantém item sem intervalo de km com lead time mínimo", () => {
    const draft = buildPlanItemDraft(
      catalogItem({ dueType: "time", defaultIntervalKm: null, defaultIntervalMonths: 24 }),
    );

    expect(draft.intervalKm).toBeNull();
    expect(draft.leadTimeKm).toBe(500);
  });
});
