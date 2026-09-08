import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";
import webpush from "web-push";
import { loadLocalEnv } from "./localEnv";
import { awsClientConfig } from "../src/libs/awsConfig";

const PUBLIC_KEY_PARAMETER = "/health_car/local/vapid_public_key";
const PRIVATE_KEY_PARAMETER = "/health_car/local/vapid_private_key";

const readParameter = async (
  client: SSMClient,
  name: string,
): Promise<string | null> => {
  try {
    const { Parameter } = await client.send(
      new GetParameterCommand({ Name: name, WithDecryption: true }),
    );
    return Parameter?.Value ?? null;
  } catch (error: any) {
    if (error?.name === "ParameterNotFound") return null;
    throw error;
  }
};

const putParameter = async (
  client: SSMClient,
  name: string,
  value: string,
): Promise<void> => {
  await client.send(
    new PutParameterCommand({
      Name: name,
      Value: value,
      Type: "SecureString",
      Overwrite: true,
    }),
  );
};

const run = async (): Promise<void> => {
  loadLocalEnv();

  const client = new SSMClient(awsClientConfig());
  const existing = await readParameter(client, PUBLIC_KEY_PARAMETER);

  if (existing) {
    console.log("par VAPID local já existe — mantido");
    console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${existing}`);
    return;
  }

  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  await putParameter(client, PUBLIC_KEY_PARAMETER, publicKey);
  await putParameter(client, PRIVATE_KEY_PARAMETER, privateKey);

  console.log("par VAPID local gerado");
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
};

run().catch((error) => {
  console.error("bootstrap do par VAPID local falhou", error);
  process.exit(1);
});
