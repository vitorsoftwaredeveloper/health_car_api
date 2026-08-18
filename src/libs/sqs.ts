import { SendMessageBatchCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const MAX_BATCH_SIZE = 10;

let sqsClient: SQSClient | null = null;

const createSqsClient = (): SQSClient => {
  if (!sqsClient) {
    sqsClient = new SQSClient({ region: process.env.REGION });
  }
  return sqsClient;
};

const queueUrl = (): string => process.env.NOTIFICATIONS_QUEUE_URL as string;

export const enqueueNotification = async (payload: unknown): Promise<void> => {
  await createSqsClient().send(
    new SendMessageCommand({
      QueueUrl: queueUrl(),
      MessageBody: JSON.stringify(payload),
    }),
  );
};

export const enqueueNotifications = async (
  payloads: unknown[],
): Promise<void> => {
  const client = createSqsClient();

  for (let start = 0; start < payloads.length; start += MAX_BATCH_SIZE) {
    const chunk = payloads.slice(start, start + MAX_BATCH_SIZE);

    await client.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl(),
        Entries: chunk.map((payload, index) => ({
          Id: String(start + index),
          MessageBody: JSON.stringify(payload),
        })),
      }),
    );
  }
};
