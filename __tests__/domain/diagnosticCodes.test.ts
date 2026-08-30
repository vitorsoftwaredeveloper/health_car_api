import {
  isGenericCode,
  isManufacturerCode,
  isValidCode,
  normalizeCode,
} from "../../src/domain/diagnosticCodes";

describe("normalizeCode", () => {
  it("aceita o código do jeito que a pessoa digita", () => {
    expect(normalizeCode(" p0300 ")).toBe("P0300");
  });
});

describe("isGenericCode", () => {
  it("reconhece código de norma nas quatro famílias", () => {
    expect(isGenericCode("P0300")).toBe(true);
    expect(isGenericCode("C0035")).toBe(true);
    expect(isGenericCode("B0001")).toBe(true);
    expect(isGenericCode("U0100")).toBe(true);
  });

  it("recusa código de fabricante e lixo", () => {
    expect(isGenericCode("P1234")).toBe(false);
    expect(isGenericCode("U3000")).toBe(false);
    expect(isGenericCode("XPTO")).toBe(false);
  });
});

describe("isManufacturerCode", () => {
  it("separa o que é numeração da montadora", () => {
    expect(isManufacturerCode("P1234")).toBe(true);
    expect(isManufacturerCode("U3000")).toBe(true);
    expect(isManufacturerCode("P0300")).toBe(false);
  });
});

describe("isValidCode", () => {
  it("aceita os dois formatos e recusa o resto", () => {
    expect(isValidCode("P0080")).toBe(true);
    expect(isValidCode("U3000")).toBe(true);
    expect(isValidCode("P00")).toBe(false);
    expect(isValidCode("")).toBe(false);
  });
});
