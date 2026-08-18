import { ScheduledHandler } from "aws-lambda";
import { runRecalculateHealth } from "../../services/jobs/recalculateHealth.service";

export const execute: ScheduledHandler = async () => {
  const result = await runRecalculateHealth();
  console.log("recalculateHealthJob finished", result);
};
