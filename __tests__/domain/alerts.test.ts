import {
  buildItemMessage,
  compareByUrgency,
  formatKm,
} from "../../src/domain/alerts";

describe("formatKm", () => {
  it("agrupa milhar no padrão brasileiro e usa valor absoluto", () => {
    expect(formatKm(5400)).toBe("5.400 km");
    expect(formatKm(-520)).toBe("520 km");
  });
});

describe("buildItemMessage", () => {
  it("explica item sem histórico", () => {
    expect(
      buildItemMessage({ status: "unknown", dueReason: null, kmRemaining: null, daysRemaining: null }),
    ).toBe("Sem histórico. Informe a última troca para começar a acompanhar.");
  });

  it("diz há quanto tempo venceu, por tempo", () => {
    expect(
      buildItemMessage({ status: "overdue", dueReason: "time", kmRemaining: null, daysRemaining: -101 }),
    ).toBe("Vencido há 101 dias, por tempo.");
  });

  it("usa singular em um dia", () => {
    expect(
      buildItemMessage({ status: "overdue", dueReason: "time", kmRemaining: null, daysRemaining: -1 }),
    ).toBe("Vencido há 1 dia, por tempo.");
  });

  it("diz há quantos km venceu", () => {
    expect(
      buildItemMessage({ status: "overdue", dueReason: "km", kmRemaining: -1520, daysRemaining: null }),
    ).toBe("Vencido há 1.520 km, por quilometragem.");
  });

  it("cai para frase genérica quando não há número", () => {
    expect(
      buildItemMessage({ status: "overdue", dueReason: null, kmRemaining: null, daysRemaining: null }),
    ).toBe("Vencido.");
    expect(
      buildItemMessage({ status: "due_soon", dueReason: null, kmRemaining: null, daysRemaining: null }),
    ).toBe("Perto de vencer.");
    expect(
      buildItemMessage({ status: "ok", dueReason: null, kmRemaining: null, daysRemaining: null }),
    ).toBe("Em dia.");
  });

  it("avisa quanto falta para vencer", () => {
    expect(
      buildItemMessage({ status: "due_soon", dueReason: "time", kmRemaining: null, daysRemaining: 12 }),
    ).toBe("Vence em 12 dias, por tempo.");
    expect(
      buildItemMessage({ status: "due_soon", dueReason: "km", kmRemaining: 480, daysRemaining: null }),
    ).toBe("Vence em 480 km, por quilometragem.");
  });

  it("mostra a folga de item em dia", () => {
    expect(
      buildItemMessage({ status: "ok", dueReason: "km", kmRemaining: 5400, daysRemaining: null }),
    ).toBe("Em dia. Vence em 5.400 km.");
    expect(
      buildItemMessage({ status: "ok", dueReason: "time", kmRemaining: null, daysRemaining: 200 }),
    ).toBe("Em dia. Vence em 200 dias.");
  });
});

describe("compareByUrgency", () => {
  const item = (
    status: any,
    dueDate: Date | null,
    criticality: any = "medium",
  ) => ({ status, dueDate, criticality });

  it("ordena vencido antes de próximo, em dia e desconhecido", () => {
    const list = [
      item("unknown", null),
      item("ok", new Date("2027-01-01")),
      item("overdue", new Date("2026-05-09")),
      item("due_soon", new Date("2026-09-01")),
    ].sort(compareByUrgency);

    expect(list.map((i) => i.status)).toEqual([
      "overdue",
      "due_soon",
      "ok",
      "unknown",
    ]);
  });

  it("dentro do mesmo status, o que vence antes vem primeiro", () => {
    const list = [
      item("overdue", new Date("2026-06-01")),
      item("overdue", new Date("2026-01-01")),
    ].sort(compareByUrgency);

    expect(list[0].dueDate).toEqual(new Date("2026-01-01"));
  });

  it("item com data vem antes do que não tem", () => {
    expect(compareByUrgency(item("ok", null), item("ok", new Date()))).toBe(1);
    expect(compareByUrgency(item("ok", new Date()), item("ok", null))).toBe(-1);
  });

  it("empate de data desempata pela criticidade", () => {
    const date = new Date("2026-09-01");

    expect(
      compareByUrgency(item("due_soon", date, "low"), item("due_soon", date, "critical")),
    ).toBeGreaterThan(0);
  });

  it("empate total mantém a ordem", () => {
    expect(compareByUrgency(item("unknown", null), item("unknown", null))).toBe(0);
  });
});
