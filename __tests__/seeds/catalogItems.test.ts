import { catalogItemsSeed } from "../../scripts/seeds/catalogItems.data";
import { CATEGORIES } from "../../src/types/catalog";

describe("catálogo de referência", () => {
  it("tem os 47 itens da decisão D7", () => {
    expect(catalogItemsSeed).toHaveLength(47);
  });

  it("não repete código", () => {
    const codes = catalogItemsSeed.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("usa código em caixa alta com underscore", () => {
    catalogItemsSeed.forEach((item) => {
      expect(item.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    });
  });

  it("usa categorias conhecidas", () => {
    catalogItemsSeed.forEach((item) => {
      expect(CATEGORIES).toContain(item.category);
    });
  });

  it("exige intervalo de km quando vence por km", () => {
    catalogItemsSeed
      .filter((item) => item.dueType === "km" || item.dueType === "both")
      .forEach((item) => {
        expect(item.defaultIntervalKm).toBeGreaterThan(0);
      });
  });

  it("exige intervalo de meses quando vence por tempo", () => {
    catalogItemsSeed
      .filter((item) => item.dueType === "time" || item.dueType === "both")
      .forEach((item) => {
        expect(item.defaultIntervalMonths).toBeGreaterThan(0);
      });
  });

  it("dá ao item de inspeção pelo menos um intervalo de verificação", () => {
    catalogItemsSeed
      .filter((item) => item.dueType === "inspection")
      .forEach((item) => {
        expect(
          item.defaultIntervalKm || item.defaultIntervalMonths,
        ).toBeTruthy();
      });
  });

  it("explica o que é e por que importa em toda peça", () => {
    catalogItemsSeed.forEach((item) => {
      expect(item.whatItIs.length).toBeGreaterThan(20);
      expect(item.whyItMatters.length).toBeGreaterThan(20);
    });
  });

  it("só agrupa códigos que existem no catálogo", () => {
    const codes = new Set(catalogItemsSeed.map((item) => item.code));

    catalogItemsSeed.forEach((item) => {
      (item.bundledWith ?? []).forEach((code) => {
        expect(codes.has(code)).toBe(true);
      });
    });
  });

  it("cobre as nove categorias", () => {
    const used = new Set(catalogItemsSeed.map((item) => item.category));
    expect(used.size).toBe(CATEGORIES.length);
  });

  it("nasce ativo", () => {
    catalogItemsSeed.forEach((item) => expect(item.active).toBe(true));
  });
});
