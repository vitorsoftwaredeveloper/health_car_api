import { SQSEvent, SQSHandler } from "aws-lambda";
import { withJobLogging } from "../../middlewares/jobHandler";
import { runSendNotifications } from "../../services/notifications/sendNotifications.service";

export const execute: SQSHandler = withJobLogging(
  "sendNotificationsJob",
  (event: SQSEvent) => runSendNotifications(event.Records),
);
