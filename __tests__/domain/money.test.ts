import { computeEventTotalCents, sumCents } from "../../src/domain/money";

describe("sumCents", () => {
  it("soma ignorando nulo e indefinido", () => {
    expect(sumCents([32000, null, 9000, undefined])).toBe(41000);
  });

  it("devolve zero sem valores", () => {
    expect(sumCents([])).toBe(0);
  });
});

describe("computeEventTotalCents", () => {
  it("soma peça, mão de obra do item e mão de obra do serviço", () => {
    const total = computeEventTotalCents(
      [
        { partCents: 32000, laborCents: 5000 },
        { partCents: 9000 },
        { partCents: null, laborCents: null },
      ],
      12000,
    );

    expect(total).toBe(58000);
  });

  it("aceita serviço sem valor nenhum", () => {
    expect(computeEventTotalCents([{ description: "inspeção" } as any])).toBe(0);
  });
});
