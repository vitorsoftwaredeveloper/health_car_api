import {
  addDays,
  addMonths,
  daysBetween,
  earliest,
  parseLocalDate,
  startOfLocalDay,
} from "../../src/utils/date";

describe("parseLocalDate", () => {
  it("trata data sem hora como dia em America/Fortaleza", () => {
    const parsed = parseLocalDate("2026-08-18");

    expect(parsed.toISOString()).toBe("2026-08-18T03:00:00.000Z");
    expect(daysBetween(parsed, parseLocalDate("2026-08-17"))).toBe(1);
  });

  it("não recua o dia na virada do mês", () => {
    expect(parseLocalDate("2026-09-01").toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(parseLocalDate("2026-01-01").toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });

  it("normaliza instante com hora para o início do dia local", () => {
    expect(parseLocalDate("2026-08-18T20:30:00.000Z").toISOString()).toBe(
      "2026-08-18T03:00:00.000Z",
    );
  });

  it("mantém no dia anterior o instante que ainda é ontem em Fortaleza", () => {
    expect(parseLocalDate("2026-08-18T02:00:00.000Z").toISOString()).toBe(
      "2026-08-17T03:00:00.000Z",
    );
  });
});

describe("startOfLocalDay", () => {
  it("é idempotente", () => {
    const once = startOfLocalDay(new Date("2026-08-18T15:00:00.000Z"));
    expect(startOfLocalDay(once).toISOString()).toBe(once.toISOString());
  });
});

describe("addDays e addMonths", () => {
  it("soma dias mantendo o início do dia local", () => {
    expect(addDays(parseLocalDate("2026-08-18"), 30).toISOString()).toBe(
      "2026-09-17T03:00:00.000Z",
    );
  });

  it("ajusta mês curto ao somar meses", () => {
    expect(addMonths(parseLocalDate("2026-01-31"), 1).toISOString()).toBe(
      "2026-02-28T03:00:00.000Z",
    );
  });

  it("soma meses cruzando o ano", () => {
    expect(addMonths(parseLocalDate("2025-05-09"), 12).toISOString()).toBe(
      "2026-05-09T03:00:00.000Z",
    );
  });
});

describe("earliest", () => {
  it("devolve a menor data ignorando nulos", () => {
    const a = parseLocalDate("2026-08-18");
    const b = parseLocalDate("2026-05-09");

    expect(earliest(a, null, b, undefined)?.toISOString()).toBe(b.toISOString());
  });

  it("devolve null sem nenhuma data válida", () => {
    expect(earliest(null, undefined)).toBeNull();
  });
});
