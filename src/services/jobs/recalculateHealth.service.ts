import { Types } from "mongoose";
import { enqueueNotifications } from "../../libs/sqs";
import { vehicleRepository } from "../../repositories/vehicle.repository";
import { VehicleDocument } from "../../types/vehicle";
import { syncAlertsForVehicle } from "../alerts/alert.service";
import { recalculateVehicle } from "../plan/recalculate.service";

const PAGE_SIZE = 50;

export interface RecalculateHealthJobResult {
  vehiclesProcessed: number;
  alertsCreated: number;
  duplicatesSkipped: number;
  vehiclesEnqueued: number;
  failures: number;
}

export interface NotificationMessage {
  accountId: string;
  vehicleId: string;
  alertIds: string[];
}

const loadPage = async (
  afterId: Types.ObjectId | null,
): Promise<VehicleDocument[]> => {
  const filter: Record<string, unknown> = { status: "active" };
  if (afterId) filter._id = { $gt: afterId };

  return (await vehicleRepository.find(filter, null, {
    sort: { _id: 1 },
    limit: PAGE_SIZE,
  })) as VehicleDocument[];
};

export const runRecalculateHealth =
  async (): Promise<RecalculateHealthJobResult> => {
    const result: RecalculateHealthJobResult = {
      vehiclesProcessed: 0,
      alertsCreated: 0,
      duplicatesSkipped: 0,
      vehiclesEnqueued: 0,
      failures: 0,
    };

    const messages: NotificationMessage[] = [];
    let afterId: Types.ObjectId | null = null;

    for (;;) {
      const vehicles = await loadPage(afterId);
      if (!vehicles.length) break;

      for (const vehicle of vehicles) {
        try {
          const recalculation = await recalculateVehicle(vehicle);
          const { created, duplicates } = await syncAlertsForVehicle(
            vehicle,
            recalculation,
          );

          result.vehiclesProcessed += 1;
          result.alertsCreated += created.length;
          result.duplicatesSkipped += duplicates;

          if (created.length) {
            messages.push({
              accountId: String(vehicle.accountId),
              vehicleId: String(vehicle._id),
              alertIds: created.map((alert) => String(alert._id)),
            });
          }
        } catch (error: any) {
          result.failures += 1;
          console.error("vehicle recalculation failed", {
            vehicleId: String(vehicle._id),
            message: error?.message,
          });
        }
      }

      afterId = vehicles[vehicles.length - 1]._id as Types.ObjectId;
      if (vehicles.length < PAGE_SIZE) break;
    }

    if (messages.length && process.env.NOTIFICATIONS_QUEUE_URL) {
      await enqueueNotifications(messages);
      result.vehiclesEnqueued = messages.length;
    }

    return result;
  };
