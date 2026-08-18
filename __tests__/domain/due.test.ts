import { computeItemStatus, defaultLeadTimeKm, isAlertSuppressed } from "../../src/domain/due";
import { ctx, d, item } from "./factories";

describe("computeItemStatus", () => {
  it("1. both: km estoura antes do tempo → dueReason km", () => {
    const r = computeItemStatus(
      item({ lastServiceKm: 70000, intervalKm: 10000, lastServiceDate: d("2026-06-01"), intervalMonths: 12 }),
      ctx({ estimatedOdometer: 79500 }),
    );
    expect(r.dueReason).toBe("km");
    expect(r.status).toBe("due_soon");
    expect(r.kmRemaining).toBe(500);
  });

  it("2. both: tempo estoura antes do km (carro parado) → dueReason time", () => {
    const r = computeItemStatus(
      item({ lastServiceKm: 70000, intervalKm: 10000, lastServiceDate: d("2025-08-18"), intervalMonths: 12 }),
      ctx({ estimatedOdometer: 71000, kmPerDay: 5 }),
    );
    expect(r.dueReason).toBe("time");
    expect(r.status).toBe("overdue");
    expect(r.daysRemaining).toBe(0);
  });

  it("3. time: nunca olha odômetro", () => {
    const r = computeItemStatus(
      item({ dueType: "time", intervalKm: null, lastServiceKm: 10, lastServiceDate: d("2026-01-01"), intervalMonths: 24 }),
      ctx({ estimatedOdometer: 999999 }),
    );
    expect(r.status).toBe("ok");
    expect(r.kmRemaining).toBeNull();
    expect(r.dueReason).toBe("time");
  });

  it("4. inspection: nunca fica overdue, vira due_soon", () => {
    const r = computeItemStatus(
      item({ dueType: "inspection", intervalKm: 10000, intervalMonths: null, lastServiceKm: 60000 }),
      ctx({ estimatedOdometer: 85000 }),
    );
    expect(r.status).toBe("due_soon");
    expect(r.kmRemaining).toBeLessThan(0);
  });

  it("4b. inspection: longe do intervalo continua ok", () => {
    const r = computeItemStatus(
      item({ dueType: "inspection", intervalKm: 10000, intervalMonths: null, lastServiceKm: 74000 }),
      ctx({ estimatedOdometer: 75000 }),
    );
    expect(r.status).toBe("ok");
  });

  it("5. sem última troca → unknown, sem nenhuma projeção", () => {
    const r = computeItemStatus(item({ lastServiceKm: null, lastServiceDate: null }), ctx());
    expect(r).toEqual({
      status: "unknown", dueDate: null, dueReason: null,
      nextDueKm: null, nextDueDate: null, kmRemaining: null, daysRemaining: null,
    });
  });

  it("5b. dueType km sem intervalKm → unknown", () => {
    const r = computeItemStatus(item({ dueType: "km", intervalKm: null, intervalMonths: null }), ctx());
    expect(r.status).toBe("unknown");
  });

  it("6. adiado: status continua real, só o alerta é suprimido", () => {
    const overdue = item({ lastServiceKm: 50000, lastServiceDate: d("2024-01-01") });
    const c = ctx();
    expect(computeItemStatus(overdue, c).status).toBe("overdue");
    expect(isAlertSuppressed({ ...overdue, snoozedUntil: d("2026-09-30") }, c)).toBe(true);
    expect(isAlertSuppressed({ ...overdue, snoozedUntil: d("2026-08-01") }, c)).toBe(false);
    expect(isAlertSuppressed({ ...overdue, snoozedUntilKm: 80000 }, c)).toBe(true);
    expect(isAlertSuppressed({ ...overdue, snoozedUntilKm: 70000 }, c)).toBe(false);
    expect(isAlertSuppressed({ ...overdue, muted: true }, c)).toBe(true);
  });

  it("8. leadTimeKm padrão = max(500, 10% do intervalo)", () => {
    expect(defaultLeadTimeKm(10000)).toBe(1000);
    expect(defaultLeadTimeKm(2000)).toBe(500);
    expect(defaultLeadTimeKm(null)).toBe(500);
    const r = computeItemStatus(
      item({ leadTimeKm: 0, intervalKm: 60000, intervalMonths: null, lastServiceKm: 20000, lastServiceDate: null }),
      ctx({ estimatedOdometer: 74500 }),
    );
    expect(r.status).toBe("due_soon");
  });

  it("10. fuso: item que vence hoje em -03 não aparece vencido ontem", () => {
    const r = computeItemStatus(
      item({ dueType: "time", intervalKm: null, intervalMonths: 12, lastServiceDate: d("2025-08-19") }),
      ctx({ today: new Date("2026-08-18T02:00:00.000Z") }),
    );
    expect(r.daysRemaining).toBe(2);
    expect(r.status).toBe("due_soon");
  });

  it("11. item custom (sem catálogo) percorre o ciclo igual", () => {
    const custom = item({ dueType: "both", criticality: "medium", intervalKm: 60000, intervalMonths: 48, lastServiceKm: 20000, lastServiceDate: d("2022-01-01") });
    expect(computeItemStatus(custom, ctx({ estimatedOdometer: 75000 })).status).toBe("overdue");
  });

  it("addMonths não estoura o mês (31/01 + 1 mês = 28/02)", () => {
    const r = computeItemStatus(
      item({ dueType: "time", intervalKm: null, intervalMonths: 1, lastServiceDate: d("2026-01-31") }),
      ctx({ today: d("2026-02-28") }),
    );
    expect(r.nextDueDate?.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});
