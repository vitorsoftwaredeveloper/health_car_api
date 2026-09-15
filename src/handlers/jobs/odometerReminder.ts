import { ScheduledHandler } from "aws-lambda";
import { withJobLogging } from "../../middlewares/jobHandler";
import { runOdometerReminder } from "../../services/jobs/odometerReminder.service";

export const execute: ScheduledHandler = withJobLogging(
  "odometerReminderJob",
  () => runOdometerReminder(),
);
