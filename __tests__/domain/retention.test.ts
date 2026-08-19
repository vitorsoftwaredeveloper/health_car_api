import {
  isPurgeDue,
  PURGE_GRACE_DAYS,
  purgeDateFrom,
} from "../../src/domain/retention";

describe("purgeDateFrom", () => {
  it("agenda o expurgo 30 dias à frente", () => {
    expect(PURGE_GRACE_DAYS).toBe(30);
    expect(purgeDateFrom(new Date("2026-08-19T12:00:00.000Z")).toISOString()).toBe(
      "2026-09-18T12:00:00.000Z",
    );
  });

  it("atravessa a virada do ano", () => {
    expect(purgeDateFrom(new Date("2026-12-20T00:00:00.000Z")).toISOString()).toBe(
      "2027-01-19T00:00:00.000Z",
    );
  });
});

describe("isPurgeDue", () => {
  const now = new Date("2026-09-18T12:00:00.000Z");

  it("é falso sem data marcada", () => {
    expect(isPurgeDue(null, now)).toBe(false);
    expect(isPurgeDue(undefined, now)).toBe(false);
  });

  it("é falso enquanto a carência não venceu", () => {
    expect(isPurgeDue(new Date("2026-09-19T00:00:00.000Z"), now)).toBe(false);
  });

  it("é verdadeiro no instante da carência e depois", () => {
    expect(isPurgeDue(now, now)).toBe(true);
    expect(isPurgeDue(new Date("2026-09-01T00:00:00.000Z"), now)).toBe(true);
  });
});
