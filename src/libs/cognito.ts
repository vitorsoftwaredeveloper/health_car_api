import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import { randomUUID } from "crypto";
import { awsClientConfig } from "./awsConfig";
import { Role } from "../types/auth";

let cognitoClient: CognitoIdentityProviderClient | null = null;

const createCognitoClient = (): CognitoIdentityProviderClient => {
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient(awsClientConfig());
  }
  return cognitoClient;
};

const userPoolId = (): string => process.env.USER_POOL_ID as string;

export const isCognitoConfigured = (): boolean => !!process.env.USER_POOL_ID;

export interface CreatedCognitoUser {
  cognitoSub: string;
  alreadyExisted: boolean;
}

export const createCognitoUser = async (
  email: string,
  name: string,
  role: Role,
): Promise<CreatedCognitoUser> => {
  if (!isCognitoConfigured()) {
    return { cognitoSub: `local-${randomUUID()}`, alreadyExisted: false };
  }

  const client = createCognitoClient();

  try {
    const { User } = await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId(),
        Username: email,
        DesiredDeliveryMediums: ["EMAIL"],
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: name },
        ],
      }),
    );

    const sub = User?.Attributes?.find(
      (attribute) => attribute.Name === "sub",
    )?.Value;

    if (!sub) {
      throw new Error("Cognito não devolveu o identificador do usuário.");
    }

    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId(),
        Username: email,
        GroupName: role,
      }),
    );

    return { cognitoSub: sub, alreadyExisted: false };
  } catch (error: unknown) {
    if (error instanceof UsernameExistsException) {
      return { cognitoSub: "", alreadyExisted: true };
    }
    throw error;
  }
};

export const deleteCognitoUser = async (email: string): Promise<void> => {
  if (!isCognitoConfigured()) return;

  await createCognitoClient().send(
    new AdminDeleteUserCommand({
      UserPoolId: userPoolId(),
      Username: email,
    }),
  );
};
