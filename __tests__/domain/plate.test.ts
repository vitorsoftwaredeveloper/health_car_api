import {
  isValidPlate,
  maskPlate,
  normalizePlate,
  plateFormat,
} from "../../src/domain/plate";

describe("normalizePlate", () => {
  it("remove separadores e sobe para maiúscula", () => {
    expect(normalizePlate("bra-2e19")).toBe("BRA2E19");
    expect(normalizePlate(" abc 1234 ")).toBe("ABC1234");
  });
});

describe("plateFormat", () => {
  it("reconhece placa Mercosul", () => {
    expect(plateFormat("BRA2E19")).toBe("mercosur");
  });

  it("reconhece placa no padrão antigo", () => {
    expect(plateFormat("ABC1234")).toBe("legacy");
  });

  it("recusa formato inválido", () => {
    expect(plateFormat("AB12345")).toBeNull();
    expect(plateFormat("BRA2E1")).toBeNull();
    expect(plateFormat("")).toBeNull();
  });
});

describe("isValidPlate", () => {
  it("aceita os dois formatos válidos", () => {
    expect(isValidPlate("bra2e19")).toBe(true);
    expect(isValidPlate("ABC-1234")).toBe(true);
  });

  it("recusa placa fora do padrão", () => {
    expect(isValidPlate("1234ABC")).toBe(false);
  });
});

describe("maskPlate", () => {
  it("esconde o final da placa", () => {
    expect(maskPlate("BRA2E19")).toBe("BRA••••");
  });

  it("esconde tudo quando a placa é curta demais", () => {
    expect(maskPlate("AB")).toBe("••");
  });
});
