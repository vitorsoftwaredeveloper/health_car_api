import webpush from "web-push";
import { getSsmParameter } from "./ssm";

let configured = false;

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushSendResult {
  ok: boolean;
  statusCode?: number;
  gone: boolean;
  error?: string;
}

const resolveSecret = async (value: string): Promise<string> =>
  value.startsWith("/") ? getSsmParameter(value) : value;

const configure = async (): Promise<void> => {
  if (configured) return;

  const publicKey = await resolveSecret(process.env.VAPID_PUBLIC_KEY as string);
  const privateKey = await resolveSecret(
    process.env.VAPID_PRIVATE_KEY as string,
  );

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    publicKey,
    privateKey,
  );
  configured = true;
};

export const sendPush = async (
  subscription: PushSubscriptionInput,
  payload: unknown,
): Promise<PushSendResult> => {
  await configure();

  try {
    const response = await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify(payload),
    );
    return { ok: true, statusCode: response.statusCode, gone: false };
  } catch (error: any) {
    const statusCode = error?.statusCode;
    return {
      ok: false,
      statusCode,
      gone: statusCode === 404 || statusCode === 410,
      error: error?.body || error?.message,
    };
  }
};
