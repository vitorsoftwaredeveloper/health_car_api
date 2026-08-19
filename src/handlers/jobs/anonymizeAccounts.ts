import { ScheduledHandler } from "aws-lambda";
import { runAnonymizeAccounts } from "../../services/purge/anonymize.service";

export const execute: ScheduledHandler = async () => {
  const result = await runAnonymizeAccounts();
  console.log("anonymizeAccountsJob finished", result);
};
