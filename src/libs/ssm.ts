import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { awsClientConfig } from "./awsConfig";
import { log } from "./logger";

let ssmClient: SSMClient | null = null;
const parameterCache = new Map<string, string>();

const createSsmClient = (): SSMClient => {
  if (!ssmClient) {
    ssmClient = new SSMClient(awsClientConfig());
  }
  return ssmClient;
};

export const getSsmParameter = async (name: string): Promise<string> => {
  const cached = parameterCache.get(name);
  if (cached) return cached;

  const { Parameter } = await createSsmClient().send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  );

  const value = Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter "${name}" not found or empty`);
  }

  parameterCache.set(name, value);
  log.debug("ssm.parameter.loaded", { name });
  return value;
};
