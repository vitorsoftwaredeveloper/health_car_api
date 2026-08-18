import { SQSRecord } from "aws-lambda";

export interface SendNotificationsJobResult {
  received: number;
  sent: number;
  skipped: number;
}

export const runSendNotifications = async (
  records: SQSRecord[],
): Promise<SendNotificationsJobResult> => ({
  received: records.length,
  sent: 0,
  skipped: 0,
});
