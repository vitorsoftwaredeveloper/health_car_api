import { ScheduledHandler } from "aws-lambda";
import { runPurgeExpired } from "../../services/purge/purge.service";

export const execute: ScheduledHandler = async () => {
  const result = await runPurgeExpired();
  console.log("purgeExpiredJob finished", result);
};
