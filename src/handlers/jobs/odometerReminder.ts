import { ScheduledHandler } from "aws-lambda";
import { runOdometerReminder } from "../../services/jobs/odometerReminder.service";

export const execute: ScheduledHandler = async () => {
  const result = await runOdometerReminder();
  console.log("odometerReminderJob finished", result);
};
