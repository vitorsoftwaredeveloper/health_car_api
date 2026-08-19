import { Types } from "mongoose";

jest.mock("../../src/libs/webpush", () => ({
  sendPush: jest.fn(async () => ({ ok: true, gone: false })),
}));

import { sendPush } from "../../src/libs/webpush";
import {
  countIn,
  findPlanItem,
  givenOwner,
  seedCatalogAndTemplate,
  setLastService,
  vehiclePayload,
} from "./helpers";
import { createVehicle } from "../../src/services/vehicles/vehicle.service";
import { createOdometerReading } from "../../src/services/odometer/odometer.service";
import { runRecalculateHealth } from "../../src/services/jobs/recalculateHealth.service";
import { runSendNotifications } from "../../src/services/notifications/sendNotifications.service";
import { registerDevice } from "../../src/services/notifications/device.service";
import { updatePreferences } from "../../src/services/users/me.service";
import { snoozeAlert } from "../../src/services/alerts/alertInbox.service";
import { alertRepository } from "../../src/repositories/alert.repository";
import { AlertDocument } from "../../src/types/alert";
import { addDays, today } from "../../src/utils/date";

const monthsAgo = (months: number, days = 0): Date =>
  addDays(
    new Date(
      Date.UTC(
        today().getUTCFullYear(),
        today().getUTCMonth() - months,
        today().getUTCDate(),
        3,
      ),
    ),
    days,
  );

const givenVehicleWithDueItems = async (suffix: string) => {
  const owner = await givenOwner(suffix);
  const vehicle = await createVehicle(owner, vehiclePayload());

  const brakeFluid = await findPlanItem(vehicle.id, "BRAKE_FLUID");
  await setLastService(brakeFluid._id as Types.ObjectId, {
    lastServiceDate: monthsAgo(24, -10),
  });

  const oil = await findPlanItem(vehicle.id, "ENGINE_OIL");
  await setLastService(oil._id as Types.ObjectId, {
    lastServiceKm: 69000,
    lastServiceDate: monthsAgo(11),
  });

  return { owner, vehicle, brakeFluid, oil };
};

const messagesFromPendingAlerts = async () => {
  const alerts = (await alertRepository.find({
    status: "pending",
  })) as AlertDocument[];

  const byVehicle = new Map<string, AlertDocument[]>();
  for (const alert of alerts) {
    const key = String(alert.vehicleId);
    byVehicle.set(key, [...(byVehicle.get(key) ?? []), alert]);
  }

  return [...byVehicle.entries()].map(([vehicleId, group]) => ({
    body: JSON.stringify({
      accountId: String(group[0].accountId),
      vehicleId,
      alertIds: group.map((alert) => String(alert._id)),
    }),
  }));
};

describe("fluxo 3 — job diário, deduplicação e notificação", () => {
  beforeEach(async () => {
    await seedCatalogAndTemplate();
  });

  it("roda duas vezes no mesmo dia sem duplicar alerta", async () => {
    await givenVehicleWithDueItems("job");

    const first = await runRecalculateHealth();
    expect(first.vehiclesProcessed).toBe(1);
    expect(first.alertsCreated).toBeGreaterThan(0);

    const second = await runRecalculateHealth();
    expect(second.alertsCreated).toBe(0);
    expect(second.duplicatesSkipped).toBe(first.alertsCreated);

    expect(await countIn("alerts")).toBe(first.alertsCreated);
  });

  it("não alerta item sem histórico", async () => {
    const { owner, vehicle } = await givenVehicleWithDueItems("unknown");

    await runRecalculateHealth();

    const alerts = (await alertRepository.find({})) as AlertDocument[];
    const unknownItems = await countIn("planItems", {
      vehicleId: new Types.ObjectId(vehicle.id),
      status: "unknown",
    });

    expect(unknownItems).toBeGreaterThan(10);
    expect(alerts.length).toBeLessThan(unknownItems);
    expect(owner.accountId).toBeDefined();
  });

  it("para de alertar item adiado e volta depois do prazo", async () => {
    const { owner } = await givenVehicleWithDueItems("snooze");

    const created = await runRecalculateHealth();
    expect(created.alertsCreated).toBeGreaterThan(0);

    const [alert] = (await alertRepository.find({
      status: "pending",
    })) as AlertDocument[];

    await snoozeAlert(owner, String(alert._id), { days: 20 });

    await alertRepository.deleteMany({ _id: alert._id });
    const afterSnooze = await runRecalculateHealth();
    expect(afterSnooze.alertsCreated).toBe(0);
  });

  it("marco desligado gera alerta mas não gera notificação", async () => {
    const { owner } = await givenVehicleWithDueItems("milestone");

    await registerDevice(owner, {
      endpoint: "https://push.integration/endpoint-1",
      keys: { p256dh: "chave-publica-de-teste", auth: "chave-auth-teste" },
      standalone: true,
    });

    await updatePreferences(owner, {
      quietHours: null,
      milestones: { D30: false, D7: false, D0: false, OVERDUE_WEEKLY: false },
    });

    const job = await runRecalculateHealth();
    expect(job.alertsCreated).toBeGreaterThan(0);

    const result = await runSendNotifications(await messagesFromPendingAlerts());

    expect(sendPush).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(
      await countIn("notifications", { skipReason: "milestone_disabled" }),
    ).toBe(1);
    expect(await countIn("alerts", { status: "pending" })).toBe(job.alertsCreated);
  });

  it("agrega os alertas do dia num push só e não repete no mesmo dia", async () => {
    const { owner } = await givenVehicleWithDueItems("push");

    await registerDevice(owner, {
      endpoint: "https://push.integration/endpoint-2",
      keys: { p256dh: "chave-publica-de-teste", auth: "chave-auth-teste" },
      standalone: true,
    });
    await updatePreferences(owner, { quietHours: null });

    const job = await runRecalculateHealth();
    expect(job.alertsCreated).toBeGreaterThan(1);

    const messages = await messagesFromPendingAlerts();
    const first = await runSendNotifications(messages);

    expect(first.sent).toBe(1);
    expect(sendPush).toHaveBeenCalledTimes(1);

    const second = await runSendNotifications(messages);
    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(1);
    expect(
      await countIn("notifications", { skipReason: "already_sent_today" }),
    ).toBe(1);
  });

  it("leitura de odômetro recalcula na hora sem esperar o job", async () => {
    const { owner, vehicle } = await givenVehicleWithDueItems("odometro");

    const result = await createOdometerReading(owner, vehicle.id, {
      km: 88000,
      date: today().toISOString().slice(0, 10),
    });

    expect(result.estimatedOdometer).toBe(88000);
    expect(result.changedItems.some((item) => item.code === "ENGINE_OIL")).toBe(true);
    expect(
      await countIn("planItems", {
        vehicleId: new Types.ObjectId(vehicle.id),
        code: "ENGINE_OIL",
        status: "overdue",
      }),
    ).toBe(1);
  });
});
