import {
  DEFAULT_TIMEZONE,
  defaultPreferences,
  isMilestoneEnabled,
  isWithinQuietHours,
  mergePreferences,
  MILESTONES,
} from "../../src/domain/preferences";
import { UserPreferences } from "../../src/types/user";

describe("defaultPreferences", () => {
  it("liga push e todos os marcos", () => {
    const preferences = defaultPreferences();

    expect(preferences.pushEnabled).toBe(true);
    expect(preferences.timezone).toBe(DEFAULT_TIMEZONE);
    expect(preferences.theme).toBe("system");
    expect(preferences.quietHours).toEqual({ start: "22:00", end: "06:00" });
    MILESTONES.forEach((milestone) => {
      expect(isMilestoneEnabled(preferences, milestone)).toBe(true);
    });
  });
});

describe("mergePreferences", () => {
  it("usa os padrões quando não há preferência gravada", () => {
    expect(mergePreferences(undefined, {})).toEqual(defaultPreferences());
  });

  it("aplica patch parcial preservando o resto", () => {
    const current = defaultPreferences();

    const merged = mergePreferences(current, {
      pushEnabled: false,
      milestones: { D30: false },
      timezone: "America/Sao_Paulo",
      theme: "dark",
    });

    expect(merged.pushEnabled).toBe(false);
    expect(merged.milestones).toEqual({
      D30: false,
      D7: true,
      D0: true,
      OVERDUE_WEEKLY: true,
    });
    expect(merged.timezone).toBe("America/Sao_Paulo");
    expect(merged.theme).toBe("dark");
    expect(merged.quietHours).toEqual(current.quietHours);
  });

  it("desliga quiet hours quando o patch manda null", () => {
    expect(mergePreferences(defaultPreferences(), { quietHours: null }).quietHours).toBeNull();
  });

  it("troca a faixa de quiet hours", () => {
    const merged = mergePreferences(defaultPreferences(), {
      quietHours: { start: "23:30", end: "06:00" },
    });

    expect(merged.quietHours).toEqual({ start: "23:30", end: "06:00" });
  });
});

describe("isMilestoneEnabled", () => {
  const preferences = mergePreferences(defaultPreferences(), {
    milestones: { D7: false, OVERDUE_WEEKLY: false },
  });

  it("resolve marco semanal por prefixo", () => {
    expect(isMilestoneEnabled(preferences, "OVERDUE_W3")).toBe(false);
  });

  it("respeita marco desligado", () => {
    expect(isMilestoneEnabled(preferences, "D7")).toBe(false);
  });

  it("mantém marco ligado", () => {
    expect(isMilestoneEnabled(preferences, "D0")).toBe(true);
  });

  it("assume ligado para marco desconhecido", () => {
    const incomplete = { milestones: {} } as unknown as UserPreferences;
    expect(isMilestoneEnabled(incomplete, "D30")).toBe(true);
  });
});

describe("isWithinQuietHours", () => {
  it("é falso quando não há faixa configurada", () => {
    expect(isWithinQuietHours(null, "23:00")).toBe(false);
  });

  it("é falso quando início e fim são iguais", () => {
    expect(isWithinQuietHours({ start: "07:00", end: "07:00" }, "07:00")).toBe(false);
  });

  it("cobre faixa no mesmo dia", () => {
    const quietHours = { start: "13:00", end: "15:00" };

    expect(isWithinQuietHours(quietHours, "13:00")).toBe(true);
    expect(isWithinQuietHours(quietHours, "14:59")).toBe(true);
    expect(isWithinQuietHours(quietHours, "15:00")).toBe(false);
    expect(isWithinQuietHours(quietHours, "12:59")).toBe(false);
  });

  it("cobre faixa que vira a meia-noite", () => {
    const quietHours = { start: "22:00", end: "07:00" };

    expect(isWithinQuietHours(quietHours, "23:10")).toBe(true);
    expect(isWithinQuietHours(quietHours, "06:59")).toBe(true);
    expect(isWithinQuietHours(quietHours, "07:00")).toBe(false);
    expect(isWithinQuietHours(quietHours, "12:00")).toBe(false);
  });
});
