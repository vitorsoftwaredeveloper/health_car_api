import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

let ssmClient: SSMClient | null = null;
const parameterCache = new Map<string, string>();

const createSsmClient = (): SSMClient => {
  if (!ssmClient) {
    ssmClient = new SSMClient({ region: process.env.REGION });
  }
  return ssmClient;
};

export const getSsmParameter = async (name: string): Promise<string> => {
  console.log("IN - getSsmParameter");

  const cached = parameterCache.get(name);
  if (cached) {
    console.log("ssm parameter reused");
    return cached;
  }

  const { Parameter } = await createSsmClient().send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  );

  const value = Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter "${name}" not found or empty`);
  }

  parameterCache.set(name, value);
  console.log("OUT - getSsmParameter");
  return value;
};
