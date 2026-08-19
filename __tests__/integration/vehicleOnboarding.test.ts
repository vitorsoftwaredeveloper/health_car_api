import { Types } from "mongoose";
import {
  countIn,
  givenOwner,
  seedCatalogAndTemplate,
  vehiclePayload,
} from "./helpers";
import {
  createVehicle,
  listVehicles,
} from "../../src/services/vehicles/vehicle.service";
import { getPlan } from "../../src/services/plan/plan.service";
import { planItemRepository } from "../../src/repositories/planItem.repository";

describe("fluxo 1 — cadastro de veículo aplicando o template", () => {
  beforeEach(async () => {
    await seedCatalogAndTemplate();
  });

  it("nasce com plano, leitura inicial e nada faltando", async () => {
    const owner = await givenOwner("onboarding");

    const vehicle = await createVehicle(owner, vehiclePayload());

    expect(vehicle.plan.templateName).toBe("Genérico");
    expect(vehicle.plan.created).toBeGreaterThan(30);

    const plan = await getPlan(owner, vehicle.id);
    expect(plan).toHaveLength(vehicle.plan.created);
    expect(plan.every((item) => item.status === "unknown")).toBe(true);
    expect(plan.every((item) => item.cycle === 0)).toBe(true);

    const active = plan.filter((item) => item.active);
    expect(active.length).toBeGreaterThan(0);
    expect(active.length).toBeLessThan(plan.length);

    expect(await countIn("odometerReadings", { km: 78000 })).toBe(1);
  });

  it("respeita a ficha do carro ao montar o plano", async () => {
    const owner = await givenOwner("fitment");

    const cvt = await createVehicle(owner, vehiclePayload());
    const manual = await createVehicle(
      owner,
      vehiclePayload({
        nickname: "Gol",
        plate: "ABC1234",
        transmission: "manual",
        manufactureYear: 2018,
        modelYear: 2019,
      }),
    );

    const codesOf = async (vehicleId: string) =>
      (await getPlan(owner, vehicleId)).map((item) => item.code);

    const cvtCodes = await codesOf(cvt.id);
    const manualCodes = await codesOf(manual.id);

    expect(cvtCodes).toContain("CVT_FLUID");
    expect(cvtCodes).not.toContain("MANUAL_GEARBOX_OIL");
    expect(cvtCodes).not.toContain("CLUTCH_KIT");

    expect(manualCodes).toContain("MANUAL_GEARBOX_OIL");
    expect(manualCodes).toContain("CLUTCH_KIT");
    expect(manualCodes).not.toContain("CVT_FLUID");
  });

  it("placa repetida aborta tudo e não deixa lixo", async () => {
    const owner = await givenOwner("duplicate");
    await createVehicle(owner, vehiclePayload());

    const planItemsBefore = await countIn("planItems");
    const readingsBefore = await countIn("odometerReadings");

    await expect(
      createVehicle(owner, vehiclePayload({ nickname: "Clone" })),
    ).rejects.toMatchObject({ code: "PLATE_ALREADY_REGISTERED" });

    expect(await countIn("vehicles")).toBe(1);
    expect(await countIn("planItems")).toBe(planItemsBefore);
    expect(await countIn("odometerReadings")).toBe(readingsBefore);
  });

  it("barra o quarto veículo da conta", async () => {
    const owner = await givenOwner("limit");

    for (const plate of ["ABC1D23", "ABC1D24", "ABC1D25"]) {
      await createVehicle(owner, vehiclePayload({ plate, nickname: plate }));
    }

    await expect(
      createVehicle(owner, vehiclePayload({ plate: "ABC1D26" })),
    ).rejects.toMatchObject({ code: "VEHICLE_LIMIT_REACHED" });

    expect(await listVehicles(owner)).toHaveLength(3);
  });

  it("isola o plano de uma conta da outra", async () => {
    const ana = await givenOwner("ana");
    const bruno = await givenOwner("bruno");

    const vehicle = await createVehicle(ana, vehiclePayload());

    await expect(getPlan(bruno, vehicle.id)).rejects.toMatchObject({
      code: "VEHICLE_NOT_FOUND",
    });

    const items = (await planItemRepository.find({
      vehicleId: new Types.ObjectId(vehicle.id),
      accountId: bruno.accountId,
    })) as unknown[];
    expect(items).toHaveLength(0);
  });
});
