import { SQSHandler } from "aws-lambda";
import { runSendNotifications } from "../../services/notifications/sendNotifications.service";

export const execute: SQSHandler = async (event) => {
  const result = await runSendNotifications(event.Records);
  console.log("sendNotificationsJob finished", result);
};
