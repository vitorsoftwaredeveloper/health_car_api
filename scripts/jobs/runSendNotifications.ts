import mongoose from "mongoose";
import { loadLocalEnv } from "../localEnv";
import { alertRepository } from "../../src/repositories/alert.repository";
import { runSendNotifications } from "../../src/services/notifications/sendNotifications.service";
import { AlertDocument } from "../../src/types/alert";

const run = async (): Promise<void> => {
  loadLocalEnv();

  const alerts = (await alertRepository.find({
    status: "pending",
  })) as AlertDocument[];

  const byVehicle = new Map<string, AlertDocument[]>();
  for (const alert of alerts) {
    const key = String(alert.vehicleId);
    byVehicle.set(key, [...(byVehicle.get(key) ?? []), alert]);
  }

  const records = [...byVehicle.entries()].map(([vehicleId, group]) => ({
    body: JSON.stringify({
      accountId: String(group[0].accountId),
      vehicleId,
      alertIds: group.map((alert) => String(alert._id)),
    }),
  }));

  console.log("resultado", await runSendNotifications(records));
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("job falhou", error);
  process.exit(1);
});
