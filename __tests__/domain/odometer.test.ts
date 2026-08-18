import { computeKmPerDay, estimateCurrentOdometer, odometerConfidence } from "../../src/domain/odometer";
import { KM_PER_DAY_FALLBACK } from "../../src/domain/constants";
import { d } from "./factories";

const today = d("2026-08-18");

describe("computeKmPerDay", () => {
  it("7. menos de 2 leituras na janela → fallback", () => {
    expect(computeKmPerDay([], today)).toBe(KM_PER_DAY_FALLBACK);
    expect(computeKmPerDay([{ km: 1000, date: d("2026-08-01") }], today)).toBe(KM_PER_DAY_FALLBACK);
  });

  it("calcula a média pela janela de 90 dias", () => {
    const readings = [
      { km: 70000, date: d("2026-06-19") },
      { km: 72000, date: today },
    ];
    expect(computeKmPerDay(readings, today)).toBe(33);
  });

  it("ignora leitura fora da janela", () => {
    const readings = [
      { km: 10000, date: d("2020-01-01") },
      { km: 70000, date: d("2026-07-19") },
      { km: 71000, date: today },
    ];
    expect(computeKmPerDay(readings, today)).toBe(33);
  });

  it("9. leitura retroativa não quebra a média (ordena por data)", () => {
    const readings = [
      { km: 71000, date: today },
      { km: 70000, date: d("2026-07-19") },
    ];
    expect(computeKmPerDay(readings, today)).toBe(33);
  });

  it("km não positivo entre leituras → fallback", () => {
    const readings = [
      { km: 71000, date: d("2026-07-19") },
      { km: 71000, date: today },
    ];
    expect(computeKmPerDay(readings, today)).toBe(KM_PER_DAY_FALLBACK);
  });
});

describe("estimateCurrentOdometer", () => {
  it("projeta a partir da última leitura", () => {
    const v = { currentOdometer: 77140, currentOdometerAt: d("2026-08-02"), kmPerDay: 33 };
    expect(estimateCurrentOdometer(v, today)).toBe(77140 + 33 * 16);
  });

  it("nunca retrocede", () => {
    const v = { currentOdometer: 77140, currentOdometerAt: today, kmPerDay: 33 };
    expect(estimateCurrentOdometer(v, today)).toBe(77140);
    expect(estimateCurrentOdometer({ ...v, currentOdometerAt: d("2026-09-01") }, today)).toBe(77140);
  });
});

describe("odometerConfidence", () => {
  it("classifica pela idade da leitura", () => {
    expect(odometerConfidence(10)).toBe("high");
    expect(odometerConfidence(30)).toBe("medium");
    expect(odometerConfidence(46)).toBe("low");
  });
});
