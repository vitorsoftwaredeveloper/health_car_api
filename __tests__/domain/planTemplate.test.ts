import { matchesTemplate, selectTemplate } from "../../src/domain/planTemplate";
import { PlanTemplateDocument } from "../../src/types/plan-template";

const template = (
  overrides: Partial<PlanTemplateDocument> = {},
): PlanTemplateDocument =>
  ({
    name: "Genérico",
    criteria: {},
    items: [],
    priority: 0,
    active: true,
    ...overrides,
  }) as PlanTemplateDocument;

const civic = { fuel: "flex" as const, transmission: "cvt" as const, modelYear: 2020 };

describe("matchesTemplate", () => {
  it("template sem critério serve para qualquer carro", () => {
    expect(matchesTemplate(template(), civic)).toBe(true);
  });

  it("ignora template desativado", () => {
    expect(matchesTemplate(template({ active: false }), civic)).toBe(false);
  });

  it("filtra por combustível", () => {
    expect(matchesTemplate(template({ criteria: { fuel: ["diesel"] } }), civic)).toBe(false);
    expect(matchesTemplate(template({ criteria: { fuel: ["flex"] } }), civic)).toBe(true);
  });

  it("filtra por câmbio e descarta câmbio desconhecido", () => {
    const cvtOnly = template({ criteria: { transmission: ["cvt"] } });

    expect(matchesTemplate(cvtOnly, civic)).toBe(true);
    expect(matchesTemplate(cvtOnly, { ...civic, transmission: "manual" })).toBe(false);
    expect(matchesTemplate(cvtOnly, { ...civic, transmission: null })).toBe(false);
  });

  it("filtra por faixa de ano", () => {
    expect(matchesTemplate(template({ criteria: { yearMin: 2021 } }), civic)).toBe(false);
    expect(matchesTemplate(template({ criteria: { yearMax: 2019 } }), civic)).toBe(false);
    expect(
      matchesTemplate(template({ criteria: { yearMin: 2015, yearMax: 2025 } }), civic),
    ).toBe(true);
  });

  it("aceita template sem objeto de critério", () => {
    expect(
      matchesTemplate({ ...template(), criteria: undefined } as any, civic),
    ).toBe(true);
  });
});

describe("selectTemplate", () => {
  it("devolve null quando nenhum template casa", () => {
    expect(selectTemplate([template({ criteria: { fuel: ["diesel"] } })], civic)).toBeNull();
  });

  it("escolhe o de maior prioridade entre os que casam", () => {
    const generic = template({ name: "Genérico", priority: 0 });
    const specific = template({ name: "Flex CVT", priority: 10, criteria: { fuel: ["flex"] } });

    expect(selectTemplate([generic, specific], civic)?.name).toBe("Flex CVT");
    expect(selectTemplate([specific, generic], civic)?.name).toBe("Flex CVT");
  });
});
