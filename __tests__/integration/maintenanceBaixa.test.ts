import { Types } from "mongoose";
import {
  countIn,
  findPlanItem,
  givenOwner,
  seedCatalogAndTemplate,
  setLastService,
  vehiclePayload,
} from "./helpers";
import { createVehicle } from "../../src/services/vehicles/vehicle.service";
import { getVehicleHealth } from "../../src/services/vehicles/health.service";
import { registerMaintenanceEvent } from "../../src/services/maintenance/maintenance.service";
import { listMaintenanceEvents } from "../../src/services/maintenance/history.service";
import { resolveAlert } from "../../src/services/alerts/resolveAlert.service";
import { listAlerts } from "../../src/services/alerts/alertInbox.service";
import { runRecalculateHealth } from "../../src/services/jobs/recalculateHealth.service";
import { alertRepository } from "../../src/repositories/alert.repository";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { addDays, today } from "../../src/utils/date";

const overdueByTime = (months: number, daysPast: number): Date =>
  addDays(
    new Date(
      Date.UTC(
        today().getUTCFullYear(),
        today().getUTCMonth() - months,
        today().getUTCDate(),
        3,
      ),
    ),
    -daysPast,
  );

describe("fluxo 2 — serviço com baixa transacional", () => {
  beforeEach(async () => {
    await seedCatalogAndTemplate();
  });

  const givenVehicleWithOverdueBrakeFluid = async (suffix: string) => {
    const owner = await givenOwner(suffix);
    const vehicle = await createVehicle(owner, vehiclePayload());

    const brakeFluid = await findPlanItem(vehicle.id, "BRAKE_FLUID");
    await setLastService(brakeFluid._id as Types.ObjectId, {
      lastServiceDate: overdueByTime(24, 10),
    });

    const oil = await findPlanItem(vehicle.id, "ENGINE_OIL");
    await setLastService(oil._id as Types.ObjectId, {
      lastServiceKm: 69000,
      lastServiceDate: addDays(today(), -40),
    });

    return { owner, vehicle, brakeFluid, oil };
  };

  it("registra o serviço, dá baixa, fecha alerta e refaz a saúde", async () => {
    const { owner, vehicle, brakeFluid, oil } =
      await givenVehicleWithOverdueBrakeFluid("baixa");

    await runRecalculateHealth();

    const before = await getVehicleHealth(owner, vehicle.id);
    expect(before.summary.overdue).toBeGreaterThan(0);
    expect(await countIn("alerts", { status: "pending" })).toBeGreaterThan(0);

    const result = await registerMaintenanceEvent(owner, vehicle.id, {
      km: 78900,
      date: today().toISOString().slice(0, 10),
      type: "preventive",
      workshop: { name: "Auto Center Nakata", city: "Fortaleza" },
      items: [
        {
          planItemId: String(brakeFluid._id),
          action: "replace",
          description: "Fluido DOT4",
          partCents: 8000,
        },
        {
          planItemId: String(oil._id),
          action: "replace",
          description: "Óleo 5W30 + filtro",
          partBrand: "Mobil",
          partCents: 32000,
        },
      ],
      laborCents: 12000,
    });

    expect(result.event.totalCents).toBe(52000);
    expect(result.closedAlerts).toBeGreaterThan(0);
    expect(result.updatedItems).toHaveLength(2);
    result.updatedItems.forEach((item) => {
      expect(item.status).toBe("ok");
      expect(item.cycle).toBe(1);
    });

    const after = await getVehicleHealth(owner, vehicle.id);
    expect(after.summary.overdue).toBe(0);
    expect(after.healthScore).toBeGreaterThan(before.healthScore);

    expect(await countIn("odometerReadings", { source: "service" })).toBe(1);
    expect(await countIn("alerts", { status: "pending" })).toBe(0);

    const timeline = await listMaintenanceEvents(owner, vehicle.id, {});
    expect(timeline.events).toHaveLength(1);
    expect(timeline.totalCentsInPage).toBe(52000);
  });

  it("aborta tudo quando um dado do serviço não fecha", async () => {
    const { owner, vehicle, oil } = await givenVehicleWithOverdueBrakeFluid("rollback");

    const cycleBefore = (await findPlanItem(vehicle.id, "ENGINE_OIL")).cycle;
    const readingsBefore = await countIn("odometerReadings");

    await expect(
      registerMaintenanceEvent(owner, vehicle.id, {
        km: 78900,
        items: [
          {
            planItemId: String(oil._id),
            action: "replace",
            description: "Óleo",
            partCents: 32000,
          },
        ],
        attachmentIds: [String(new Types.ObjectId())],
      }),
    ).rejects.toMatchObject({ code: "ATTACHMENT_NOT_FOUND" });

    expect(await countIn("maintenanceEvents")).toBe(0);
    expect(await countIn("odometerReadings")).toBe(readingsBefore);
    expect((await findPlanItem(vehicle.id, "ENGINE_OIL")).cycle).toBe(cycleBefore);
  });

  it("recusa quilometragem que anda para trás", async () => {
    const { owner, vehicle, oil } = await givenVehicleWithOverdueBrakeFluid("regressao");

    await expect(
      registerMaintenanceEvent(owner, vehicle.id, {
        km: 10000,
        items: [
          { planItemId: String(oil._id), action: "replace", description: "Óleo" },
        ],
      }),
    ).rejects.toMatchObject({ code: "ODOMETER_REGRESSION" });

    expect(await countIn("maintenanceEvents")).toBe(0);
  });

  it("resolve a pendência pelo Já fiz, gerando evento quick_log", async () => {
    const { owner, vehicle } = await givenVehicleWithOverdueBrakeFluid("jafiz");

    await runRecalculateHealth();

    const { alerts } = await listAlerts(owner, { status: "pending" });
    const target = alerts[0];

    const result = await resolveAlert(owner, target.id, {
      km: 78900,
      date: today().toISOString().slice(0, 10),
    });

    expect(result.event.source).toBe("quick_log");
    expect(result.event.totalCents).toBe(0);
    expect(result.updatedItems[0].status).toBe("ok");

    const resolved = await alertRepository.findOne({
      _id: new Types.ObjectId(target.id),
    });
    expect((resolved as any).status).toBe("resolved");
    expect((resolved as any).resolvedByEventId).toBeTruthy();

    await expect(
      resolveAlert(owner, target.id, { km: 79000 }),
    ).rejects.toMatchObject({ code: "ALERT_ALREADY_RESOLVED" });
  });

  it("limpa o adiamento do item ao dar baixa", async () => {
    const { owner, vehicle, oil } = await givenVehicleWithOverdueBrakeFluid("snooze");

    await planItemRepository.updateOne(
      { _id: oil._id },
      { $set: { snoozedUntil: addDays(today(), 15), snoozedUntilKm: 90000 } },
    );

    await registerMaintenanceEvent(owner, vehicle.id, {
      km: 78900,
      items: [
        { planItemId: String(oil._id), action: "replace", description: "Óleo" },
      ],
    });

    const after = await findPlanItem(vehicle.id, "ENGINE_OIL");
    expect(after.snoozedUntil).toBeNull();
    expect(after.snoozedUntilKm).toBeNull();
  });
});
