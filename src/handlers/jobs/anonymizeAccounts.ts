import { ScheduledHandler } from "aws-lambda";
import { withJobLogging } from "../../middlewares/jobHandler";
import { runAnonymizeAccounts } from "../../services/purge/anonymize.service";

export const execute: ScheduledHandler = withJobLogging(
  "anonymizeAccountsJob",
  () => runAnonymizeAccounts(),
);
