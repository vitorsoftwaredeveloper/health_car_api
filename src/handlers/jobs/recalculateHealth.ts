import { ScheduledHandler } from "aws-lambda";
import { withJobLogging } from "../../middlewares/jobHandler";
import { runRecalculateHealth } from "../../services/jobs/recalculateHealth.service";

export const execute: ScheduledHandler = withJobLogging(
  "recalculateHealthJob",
  () => runRecalculateHealth(),
);
