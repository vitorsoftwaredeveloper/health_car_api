import { catalogItemsSeed } from "../../scripts/seeds/catalogItems.data";
import { COMMON_TO_EVERY_VEHICLE } from "../../scripts/seeds/commonPlanItems";
import { appliesToVehicle } from "../../src/domain/planItem";
import { CatalogItemDocument, CATEGORIES } from "../../src/types/catalog";
import { Fuel, Transmission } from "../../src/types/vehicle";

describe("catálogo de referência", () => {
  it("tem os 54 itens da decisão D7", () => {
    expect(catalogItemsSeed).toHaveLength(54);
  });

  it("não repete código", () => {
    const codes = catalogItemsSeed.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("usa código em caixa alta com underscore", () => {
    catalogItemsSeed.forEach((item) => {
      expect(item.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    });
  });

  it("usa categorias conhecidas", () => {
    catalogItemsSeed.forEach((item) => {
      expect(CATEGORIES).toContain(item.category);
    });
  });

  it("exige intervalo de km quando vence por km", () => {
    catalogItemsSeed
      .filter((item) => item.dueType === "km" || item.dueType === "both")
      .forEach((item) => {
        expect(item.defaultIntervalKm).toBeGreaterThan(0);
      });
  });

  it("exige intervalo de meses quando vence por tempo", () => {
    catalogItemsSeed
      .filter((item) => item.dueType === "time" || item.dueType === "both")
      .forEach((item) => {
        expect(item.defaultIntervalMonths).toBeGreaterThan(0);
      });
  });

  it("dá ao item de inspeção pelo menos um intervalo de verificação", () => {
    catalogItemsSeed
      .filter((item) => item.dueType === "inspection")
      .forEach((item) => {
        expect(
          item.defaultIntervalKm || item.defaultIntervalMonths,
        ).toBeTruthy();
      });
  });

  it("explica o que é e por que importa em toda peça", () => {
    catalogItemsSeed.forEach((item) => {
      expect(item.whatItIs.length).toBeGreaterThan(20);
      expect(item.whyItMatters.length).toBeGreaterThan(20);
    });
  });

  it("só agrupa códigos que existem no catálogo", () => {
    const codes = new Set(catalogItemsSeed.map((item) => item.code));

    catalogItemsSeed.forEach((item) => {
      (item.bundledWith ?? []).forEach((code) => {
        expect(codes.has(code)).toBe(true);
      });
    });
  });

  it("cobre as nove categorias", () => {
    const used = new Set(catalogItemsSeed.map((item) => item.category));
    expect(used.size).toBe(CATEGORIES.length);
  });

  it("nasce ativo", () => {
    catalogItemsSeed.forEach((item) => expect(item.active).toBe(true));
  });

  it("mantém peça de motor a combustão fora do carro elétrico", () => {
    const combustionOnly = [
      "ENGINE_OIL",
      "SPARK_PLUGS",
      "FUEL_FILTER",
      "TIMING_BELT_KIT",
      "TIMING_CHAIN",
      "ACCESSORY_BELT",
      "COOLANT",
      "WATER_PUMP",
      "ALTERNATOR",
      "STARTER_MOTOR",
      "POWER_STEERING_FLUID",
    ];

    combustionOnly.forEach((code) => {
      const item = catalogItemsSeed.find((entry) => entry.code === code);
      expect(item?.appliesTo?.fuel).toBeDefined();
      expect(item?.appliesTo?.fuel).not.toContain("electric");
    });
  });

  it("cobre a manutenção do carro elétrico", () => {
    const electricItems = catalogItemsSeed.filter((item) =>
      appliesToVehicle(item as CatalogItemDocument, { fuel: "electric" }),
    );

    expect(electricItems.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "EV_BATTERY_COOLANT",
        "EV_TRACTION_BATTERY_CHECK",
        "EV_HV_CABLES",
        "EV_CHARGING_CABLE",
        "EV_REDUCTION_GEARBOX_OIL",
        "EV_BRAKE_CALIPER_SERVICE",
        "BRAKE_FLUID",
        "TIRES",
        "WHEEL_ALIGNMENT",
        "BATTERY",
        "CABIN_FILTER",
      ]),
    );
  });
});

describe("itens comuns a todo veículo", () => {
  const byCode = new Map(catalogItemsSeed.map((item) => [item.code, item]));

  const planFor = (fuel: Fuel, transmission: Transmission) =>
    COMMON_TO_EVERY_VEHICLE.map((code) => byCode.get(code))
      .filter((item): item is (typeof catalogItemsSeed)[number] => !!item)
      .filter((item) =>
        appliesToVehicle(item as CatalogItemDocument, { fuel, transmission }),
      )
      .map((item) => item.code);

  it("só lista código que existe no catálogo", () => {
    COMMON_TO_EVERY_VEHICLE.forEach((code) => {
      expect(byCode.has(code)).toBe(true);
    });
  });

  it("não repete código", () => {
    expect(new Set(COMMON_TO_EVERY_VEHICLE).size).toBe(
      COMMON_TO_EVERY_VEHICLE.length,
    );
  });

  it("liga o serviço que todo carro faz", () => {
    expect(planFor("flex", "automatic")).toEqual(
      expect.arrayContaining([
        "ENGINE_OIL",
        "BRAKE_FLUID",
        "BRAKE_PADS_FRONT",
        "TIRES",
        "WHEEL_ALIGNMENT",
        "TIRE_ROTATION",
        "BATTERY",
        "CABIN_FILTER",
        "WIPER_BLADES",
      ]),
    );
  });

  it("dá ao carro um único óleo de câmbio", () => {
    const gearboxOils = ["MANUAL_GEARBOX_OIL", "AUTO_GEARBOX_OIL", "CVT_FLUID"];

    const combinations: [Fuel, Transmission][] = [
      ["flex", "manual"],
      ["flex", "automatic"],
      ["flex", "cvt"],
      ["diesel", "automated"],
    ];

    combinations.forEach(([fuel, transmission]) => {
      const applied = planFor(fuel, transmission).filter((code) =>
        gearboxOils.includes(code),
      );
      expect(applied).toHaveLength(1);
    });
  });

  it("monta o plano do elétrico sem peça de motor a combustão", () => {
    const plan = planFor("electric", "automatic");

    expect(plan).toEqual(
      expect.arrayContaining([
        "EV_BATTERY_COOLANT",
        "EV_TRACTION_BATTERY_CHECK",
        "EV_REDUCTION_GEARBOX_OIL",
        "BRAKE_FLUID",
        "TIRES",
        "BATTERY",
      ]),
    );

    ["ENGINE_OIL", "SPARK_PLUGS", "FUEL_FILTER", "TIMING_BELT_KIT", "COOLANT"].forEach(
      (code) => expect(plan).not.toContain(code),
    );
  });

  it("dá ao híbrido o motor e o pacote elétrico", () => {
    const plan = planFor("hybrid", "cvt");

    expect(plan).toEqual(
      expect.arrayContaining([
        "ENGINE_OIL",
        "SPARK_PLUGS",
        "HYBRID_BATTERY_FAN_FILTER",
        "EV_BATTERY_COOLANT",
      ]),
    );
    expect(plan).not.toContain("EV_REDUCTION_GEARBOX_OIL");
  });

  it("mantém o plano inicial enxuto", () => {
    expect(planFor("flex", "automatic").length).toBeLessThanOrEqual(20);
    expect(planFor("electric", "automatic").length).toBeLessThanOrEqual(18);
    expect(planFor("hybrid", "cvt").length).toBeLessThanOrEqual(25);
  });
});
