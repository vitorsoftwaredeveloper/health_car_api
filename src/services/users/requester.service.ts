import { Types } from "mongoose";
import { withTransaction } from "../../libs/mongo";
import { defaultPreferences } from "../../domain/preferences";
import { accountRepository } from "../../repositories/account.repository";
import { userRepository } from "../../repositories/user.repository";
import { AuthClaims } from "../../types/auth";
import { Requester, UserDocument } from "../../types/user";
import { DEFAULT_VEHICLE_LIMIT } from "../../models/account.model";
import {
  DUPLICATE_KEY_ERROR_CODE,
  httpError,
  STATUS_CODE,
} from "../../utils/errors";

const nameFromEmail = (email: string): string => {
  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.join(" ") || "Proprietário";
};

const toRequester = (user: UserDocument): Requester => ({
  userId: user._id as Types.ObjectId,
  accountId: user.accountId,
  role: user.role,
  user,
});

const findByCognitoSub = async (
  cognitoSub: string,
): Promise<UserDocument | null> =>
  (await userRepository.findOne({ cognitoSub })) as UserDocument | null;

const provisionOwner = async (auth: AuthClaims): Promise<UserDocument> => {
  const accountId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const name = nameFromEmail(auth.email);

  return withTransaction(async (session) => {
    await accountRepository.insertOne(
      {
        _id: accountId,
        name,
        ownerId: userId,
        plan: "free",
        vehicleLimit: DEFAULT_VEHICLE_LIMIT,
        status: "active",
      },
      { session },
    );

    const created = await userRepository.insertOne(
      {
        _id: userId,
        accountId,
        cognitoSub: auth.sub,
        name,
        email: auth.email,
        role: auth.role,
        preferences: defaultPreferences(),
      },
      { session },
    );

    return created.toObject() as UserDocument;
  });
};

export const resolveRequester = async (
  auth: AuthClaims,
): Promise<Requester> => {
  const existing = await findByCognitoSub(auth.sub);
  if (existing) return toRequester(existing);

  if (!auth.email) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "EMAIL_REQUIRED",
      "Token sem e-mail. Faça login novamente.",
    );
  }

  try {
    return toRequester(await provisionOwner(auth));
  } catch (error: any) {
    if (error?.code !== DUPLICATE_KEY_ERROR_CODE) throw error;

    const raced = await findByCognitoSub(auth.sub);
    if (raced) return toRequester(raced);

    throw httpError(
      STATUS_CODE.CONFLICT,
      "EMAIL_ALREADY_REGISTERED",
      "Este e-mail já está vinculado a outra conta.",
    );
  }
};
