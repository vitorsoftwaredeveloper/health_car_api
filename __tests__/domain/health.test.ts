import { computeHealthScore, consumedFraction, healthBand, itemHealth } from "../../src/domain/health";
import { ctx, d, item } from "./factories";

describe("computeHealthScore", () => {
  it("12a. tudo recém-trocado → 100", () => {
    const novo = item({ lastServiceKm: 75000, lastServiceDate: d("2026-08-18") });
    expect(computeHealthScore([novo, novo], ctx())).toBe(100);
  });

  it("12b. plano só com unknown → 100 (não pune quem ainda não preencheu)", () => {
    const semRef = item({ lastServiceKm: null, lastServiceDate: null });
    expect(computeHealthScore([semRef, semRef], ctx())).toBe(100);
    expect(itemHealth(semRef, ctx())).toBeNull();
  });

  it("12c. vencido crítico derruba mais que vencido de baixa criticidade", () => {
    const vencido = { lastServiceKm: 50000, lastServiceDate: d("2020-01-01") };
    const novo = item({ lastServiceKm: 75000, lastServiceDate: d("2026-08-18"), criticality: "medium" as const });

    const comCritico = computeHealthScore([item({ ...vencido, criticality: "critical" }), novo], ctx());
    const comBaixo = computeHealthScore([item({ ...vencido, criticality: "low" }), novo], ctx());

    expect(comCritico).toBeLessThan(comBaixo);
  });

  it("12d. um vencido não zera o veículo inteiro", () => {
    const novo = item({ lastServiceKm: 75000, lastServiceDate: d("2026-08-18") });
    const score = computeHealthScore(
      [item({ lastServiceKm: 50000, lastServiceDate: d("2020-01-01"), criticality: "critical" }), novo, novo, novo],
      ctx(),
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("item inativo não entra na conta", () => {
    const vencido = item({ lastServiceKm: 50000, lastServiceDate: d("2020-01-01"), active: false });
    const novo = item({ lastServiceKm: 75000, lastServiceDate: d("2026-08-18") });
    expect(computeHealthScore([vencido, novo], ctx())).toBe(100);
  });

  it("lista vazia → 100", () => {
    expect(computeHealthScore([], ctx())).toBe(100);
  });

  it("consumedFraction usa a maior das dimensões em `both`", () => {
    const meioKm = item({ lastServiceKm: 70000, intervalKm: 10000, lastServiceDate: d("2026-08-01"), intervalMonths: 12 });
    expect(consumedFraction(meioKm, ctx({ estimatedOdometer: 75000 }))).toBeCloseTo(0.5, 2);
  });

  it("consumedFraction sem base → null", () => {
    expect(consumedFraction(item({ lastServiceKm: null, lastServiceDate: null, intervalKm: null, intervalMonths: null }), ctx())).toBeNull();
  });

  it("inspection consome por km", () => {
    const insp = item({ dueType: "inspection", intervalKm: 10000, intervalMonths: null, lastServiceKm: 70000 });
    expect(consumedFraction(insp, ctx({ estimatedOdometer: 72500 }))).toBeCloseTo(0.25, 2);
  });

  it("healthBand", () => {
    expect(healthBand(90)).toBe("good");
    expect(healthBand(67)).toBe("warning");
    expect(healthBand(40)).toBe("bad");
  });
});
