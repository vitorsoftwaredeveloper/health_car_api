import {
  acceptsFuelKind,
  allowedFuelKinds,
  measureFills,
  sortFills,
  summarizeFuel,
  type FuelFill,
} from "../../src/domain/fuel";

const fill = (
  id: string,
  date: string,
  odometerKm: number,
  liters: number,
  overrides: Partial<FuelFill> = {},
): FuelFill => ({
  id,
  date: new Date(date),
  odometerKm,
  liters,
  fullTank: true,
  totalCents: null,
  fuelKind: "gasoline",
  ...overrides,
});

describe("sortFills", () => {
  it("ordena por data e desempata pelo odômetro", () => {
    const ordered = sortFills([
      fill("b", "2026-08-10", 1200, 30),
      fill("c", "2026-08-10", 1100, 30),
      fill("a", "2026-08-01", 1000, 30),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["a", "c", "b"]);
  });
});

describe("measureFills", () => {
  it("o primeiro tanque cheio não mede nada", () => {
    const { metrics, segments } = measureFills([fill("a", "2026-08-01", 1000, 40)]);

    expect(metrics[0].kmPerLiter).toBeNull();
    expect(metrics[0].distanceKm).toBeNull();
    expect(segments).toHaveLength(0);
  });

  it("mede entre dois tanques cheios", () => {
    const { metrics } = measureFills([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-10", 1500, 40, { totalCents: 24000 }),
    ]);

    expect(metrics[1]).toEqual({
      id: "b",
      distanceKm: 500,
      litersCounted: 40,
      kmPerLiter: 12.5,
      pricePerLiterCents: 600,
      costPerKmCents: 48,
    });
  });

  it("abastecimento parcial soma litros no próximo tanque cheio", () => {
    const { metrics, segments } = measureFills([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-05", 1200, 10, { fullTank: false, totalCents: 6000 }),
      fill("c", "2026-08-10", 1500, 30, { totalCents: 18000 }),
    ]);

    expect(metrics[1].kmPerLiter).toBeNull();
    expect(metrics[1].pricePerLiterCents).toBe(600);
    expect(metrics[2].litersCounted).toBe(40);
    expect(metrics[2].kmPerLiter).toBe(12.5);
    expect(metrics[2].costPerKmCents).toBe(48);
    expect(segments).toHaveLength(1);
  });

  it("segmento sem preço em algum abastecimento fica sem custo por km", () => {
    const { metrics } = measureFills([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-05", 1200, 10, { fullTank: false }),
      fill("c", "2026-08-10", 1500, 30, { totalCents: 18000 }),
    ]);

    expect(metrics[2].kmPerLiter).toBe(12.5);
    expect(metrics[2].costPerKmCents).toBeNull();
  });

  it("distância zero ou negativa não vira medição", () => {
    const { metrics, segments } = measureFills([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-02", 1000, 5),
    ]);

    expect(metrics[1].kmPerLiter).toBeNull();
    expect(metrics[1].costPerKmCents).toBeNull();
    expect(segments).toHaveLength(0);
  });

  it("litros zero no abastecimento não gera preço por litro", () => {
    const { metrics } = measureFills([fill("a", "2026-08-01", 1000, 0, { totalCents: 100 })]);

    expect(metrics[0].pricePerLiterCents).toBeNull();
  });
});

describe("summarizeFuel", () => {
  it("resume série vazia sem inventar número", () => {
    expect(summarizeFuel([])).toEqual({
      fills: 0,
      measuredFills: 0,
      totalLiters: 0,
      totalCents: 0,
      totalDistanceKm: 0,
      averageKmPerLiter: null,
      lastKmPerLiter: null,
      bestKmPerLiter: null,
      worstKmPerLiter: null,
      costPerKmCents: null,
      trend: null,
      byFuelKind: [],
    });
  });

  it("média é ponderada por distância, não média de razões", () => {
    const summary = summarizeFuel([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-10", 1400, 40, { totalCents: 24000 }),
      fill("c", "2026-08-20", 2000, 40, { totalCents: 24000 }),
    ]);

    expect(summary.measuredFills).toBe(2);
    expect(summary.averageKmPerLiter).toBe(12.5);
    expect(summary.lastKmPerLiter).toBe(15);
    expect(summary.bestKmPerLiter).toBe(15);
    expect(summary.worstKmPerLiter).toBe(10);
    expect(summary.totalDistanceKm).toBe(1000);
    expect(summary.costPerKmCents).toBe(48);
    expect(summary.totalCents).toBe(48000);
    expect(summary.totalLiters).toBe(120);
  });

  it("tendência precisa de três medições", () => {
    const summary = summarizeFuel([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-10", 1400, 40),
      fill("c", "2026-08-20", 1800, 40),
    ]);

    expect(summary.trend).toBeNull();
  });

  it("queda acima de dez por cento vira tendência de queda", () => {
    const summary = summarizeFuel([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-10", 1400, 40),
      fill("c", "2026-08-20", 1800, 40),
      fill("d", "2026-08-30", 2200, 40),
      fill("e", "2026-09-10", 2500, 40),
    ]);

    expect(summary.trend).toBe("drop");
  });

  it("alta acima de dez por cento vira tendência de alta", () => {
    const summary = summarizeFuel([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-10", 1400, 40),
      fill("c", "2026-08-20", 1800, 40),
      fill("d", "2026-08-30", 2200, 40),
      fill("e", "2026-09-10", 2700, 40),
    ]);

    expect(summary.trend).toBe("rise");
  });

  it("variação dentro da tolerância é estável", () => {
    const summary = summarizeFuel([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-10", 1400, 40),
      fill("c", "2026-08-20", 1800, 40),
      fill("d", "2026-08-30", 2200, 40),
      fill("e", "2026-09-10", 2610, 40),
    ]);

    expect(summary.trend).toBe("stable");
  });

  it("custo por km ignora segmentos sem preço", () => {
    const summary = summarizeFuel([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-10", 1400, 40),
      fill("c", "2026-08-20", 1900, 50, { totalCents: 30000 }),
    ]);

    expect(summary.costPerKmCents).toBe(60);
  });

  it("agrupa por combustível usando o tanque que fechou a medição", () => {
    const summary = summarizeFuel([
      fill("a", "2026-08-01", 1000, 40),
      fill("b", "2026-08-10", 1400, 40, { fuelKind: "ethanol" }),
      fill("c", "2026-08-20", 2000, 40, { fuelKind: "gasoline" }),
      fill("d", "2026-08-30", 2360, 40, { fuelKind: "ethanol" }),
    ]);

    expect(summary.byFuelKind).toEqual([
      { fuelKind: "ethanol", fills: 2, averageKmPerLiter: 9.5 },
      { fuelKind: "gasoline", fills: 1, averageKmPerLiter: 15 },
    ]);
  });
});

describe("combustível aceito por veículo", () => {
  it("flex aceita gasolina e etanol", () => {
    expect(allowedFuelKinds("flex")).toEqual(["gasoline", "ethanol"]);
    expect(acceptsFuelKind("flex", "diesel")).toBe(false);
  });

  it("elétrico não abastece", () => {
    expect(allowedFuelKinds("electric")).toEqual([]);
    expect(acceptsFuelKind("electric", "gasoline")).toBe(false);
  });

  it("combustível desconhecido não aceita nada", () => {
    expect(allowedFuelKinds("steam")).toEqual([]);
  });
});
