import { decrypt, encrypt } from "../../libs/crypto";
import { mergePreferences, PreferencesPatch } from "../../domain/preferences";
import { accountRepository } from "../../repositories/account.repository";
import { userRepository } from "../../repositories/user.repository";
import { AccountDocument, Requester, Theme, UserDocument, UserPreferences } from "../../types/user";
import { listVehicles, VehicleView } from "../vehicles/vehicle.service";
import { httpError, STATUS_CODE } from "../../utils/errors";

export interface UpdateMePayload {
  name?: string;
  phone?: string | null;
  theme?: Theme;
}

export interface LgpdConsentPayload {
  termsVersion: string;
}

export interface MeView {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    preferences: UserPreferences;
    lgpdAcceptedAt: Date | null;
    lgpdTermsVersion: string | null;
  };
  account: {
    id: string;
    name: string;
    plan: string;
    vehicleLimit: number;
    isOwner: boolean;
  };
  vehicles: VehicleView[];
}

const loadAccount = async (
  requester: Requester,
): Promise<AccountDocument> => {
  const account = (await accountRepository.findById(
    requester.accountId,
  )) as AccountDocument | null;

  if (!account) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "ACCOUNT_NOT_FOUND",
      "Conta não encontrada.",
    );
  }

  return account;
};

const toView = async (
  user: UserDocument,
  account: AccountDocument,
  vehicles: VehicleView[],
): Promise<MeView> => ({
  user: {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ? await decrypt(user.phone) : null,
    role: user.role,
    preferences: user.preferences,
    lgpdAcceptedAt: user.lgpdAcceptedAt ?? null,
    lgpdTermsVersion: user.lgpdTermsVersion ?? null,
  },
  account: {
    id: String(account._id),
    name: account.name,
    plan: account.plan,
    vehicleLimit: account.vehicleLimit,
    isOwner: String(account.ownerId) === String(user._id),
  },
  vehicles,
});

const applyUpdate = async (
  requester: Requester,
  update: Record<string, unknown>,
): Promise<MeView> => {
  const updated = (await userRepository.findOneAndUpdate(
    { _id: requester.userId },
    { $set: update },
  )) as unknown as UserDocument | null;

  if (!updated) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "USER_NOT_FOUND",
      "Usuário não encontrado.",
    );
  }

  return toView(
    updated,
    await loadAccount(requester),
    await listVehicles({ ...requester, user: updated }),
  );
};

export const getMe = async (requester: Requester): Promise<MeView> =>
  toView(
    requester.user,
    await loadAccount(requester),
    await listVehicles(requester),
  );

export const updateMe = async (
  requester: Requester,
  payload: UpdateMePayload,
): Promise<MeView> => {
  const update: Record<string, unknown> = {};

  if (payload.name !== undefined) update.name = payload.name.trim();

  if (payload.phone !== undefined) {
    update.phone = payload.phone ? await encrypt(payload.phone.trim()) : null;
  }

  if (payload.theme !== undefined) {
    update.preferences = mergePreferences(requester.user.preferences, {
      theme: payload.theme,
    });
  }

  if (!Object.keys(update).length) {
    return getMe(requester);
  }

  return applyUpdate(requester, update);
};

export const updatePreferences = async (
  requester: Requester,
  payload: PreferencesPatch,
): Promise<MeView> =>
  applyUpdate(requester, {
    preferences: mergePreferences(requester.user.preferences, payload),
  });

export const acceptLgpdConsent = async (
  requester: Requester,
  payload: LgpdConsentPayload,
): Promise<MeView> =>
  applyUpdate(requester, {
    lgpdAcceptedAt: new Date(),
    lgpdTermsVersion: payload.termsVersion,
  });
