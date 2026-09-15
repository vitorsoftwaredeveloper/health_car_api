import { ScheduledHandler } from "aws-lambda";
import { withJobLogging } from "../../middlewares/jobHandler";
import { runPurgeExpired } from "../../services/purge/purge.service";

export const execute: ScheduledHandler = withJobLogging(
  "purgeExpiredJob",
  () => runPurgeExpired(),
);
