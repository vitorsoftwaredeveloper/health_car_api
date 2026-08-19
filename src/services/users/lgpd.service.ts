import { Types } from "mongoose";
import { purgeDateFrom } from "../../domain/retention";
import { decrypt } from "../../libs/crypto";
import { accountRepository } from "../../repositories/account.repository";
import { alertRepository } from "../../repositories/alert.repository";
import { attachmentRepository } from "../../repositories/attachment.repository";
import { maintenanceEventRepository } from "../../repositories/maintenanceEvent.repository";
import { notificationRepository } from "../../repositories/notification.repository";
import { odometerReadingRepository } from "../../repositories/odometerReading.repository";
import { planItemRepository } from "../../repositories/planItem.repository";
import { userRepository } from "../../repositories/user.repository";
import { vehicleRepository } from "../../repositories/vehicle.repository";
import { AccountDocument, Requester, UserDocument } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { httpError, STATUS_CODE } from "../../utils/errors";

export interface AccountDeletionView {
  status: string;
  deletionRequestedAt: Date | null;
  purgeAfter: Date | null;
}

const loadAccount = async (requester: Requester): Promise<AccountDocument> => {
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

const assertIsAccountOwner = (
  requester: Requester,
  account: AccountDocument,
): void => {
  if (String(account.ownerId) !== String(requester.userId)) {
    throw httpError(
      STATUS_CODE.FORBIDDEN,
      "FORBIDDEN",
      "Só o proprietário da conta pode pedir a exclusão.",
    );
  }
};

export const exportAccountData = async (
  requester: Requester,
): Promise<Record<string, unknown>> => {
  const account = await loadAccount(requester);
  const scope = { accountId: requester.accountId };

  const [users, vehicles, planItems, readings, events, attachments, alerts] =
    await Promise.all([
      userRepository.find(scope) as Promise<UserDocument[]>,
      vehicleRepository.find(scope) as Promise<VehicleDocument[]>,
      planItemRepository.find(scope),
      odometerReadingRepository.find(scope, null, { sort: { date: -1 } }),
      maintenanceEventRepository.find(scope, null, { sort: { date: -1 } }),
      attachmentRepository.find(scope),
      alertRepository.find(scope, null, { sort: { createdAt: -1 } }),
    ]);

  return {
    exportedAt: new Date(),
    account: {
      id: String(account._id),
      name: account.name,
      plan: account.plan,
      vehicleLimit: account.vehicleLimit,
      status: account.status,
      createdAt: account.createdAt,
    },
    users: await Promise.all(
      users.map(async (user) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone ? await decrypt(user.phone) : null,
        role: user.role,
        preferences: user.preferences,
        lgpdAcceptedAt: user.lgpdAcceptedAt ?? null,
        lgpdTermsVersion: user.lgpdTermsVersion ?? null,
        createdAt: user.createdAt,
      })),
    ),
    vehicles: await Promise.all(
      vehicles.map(async (vehicle) => ({
        id: String(vehicle._id),
        nickname: vehicle.nickname,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim ?? null,
        manufactureYear: vehicle.manufactureYear,
        modelYear: vehicle.modelYear,
        fuel: vehicle.fuel,
        transmission: vehicle.transmission ?? null,
        plate: await decrypt(vehicle.plate),
        vin: vehicle.vin ? await decrypt(vehicle.vin) : null,
        currentOdometer: vehicle.currentOdometer,
        currentOdometerAt: vehicle.currentOdometerAt,
        healthScore: vehicle.healthScore,
        status: vehicle.status,
        createdAt: vehicle.createdAt,
      })),
    ),
    planItems,
    odometerReadings: readings,
    maintenanceEvents: events,
    attachments,
    alerts,
  };
};

export const requestAccountDeletion = async (
  requester: Requester,
): Promise<AccountDeletionView> => {
  const account = await loadAccount(requester);
  assertIsAccountOwner(requester, account);

  if (account.status === "pending_deletion") {
    return {
      status: account.status,
      deletionRequestedAt: account.deletionRequestedAt ?? null,
      purgeAfter: account.purgeAfter ?? null,
    };
  }

  const deletionRequestedAt = new Date();
  const purgeAfter = purgeDateFrom(deletionRequestedAt);

  await accountRepository.updateOne(
    { _id: account._id },
    {
      $set: {
        status: "pending_deletion",
        deletionRequestedAt,
        purgeAfter,
      },
    },
  );

  return { status: "pending_deletion", deletionRequestedAt, purgeAfter };
};

export const cancelAccountDeletion = async (
  requester: Requester,
): Promise<AccountDeletionView> => {
  const account = await loadAccount(requester);
  assertIsAccountOwner(requester, account);

  if (account.status !== "pending_deletion") {
    throw httpError(
      STATUS_CODE.CONFLICT,
      "NO_DELETION_IN_PROGRESS",
      "Não há pedido de exclusão em andamento.",
    );
  }

  await accountRepository.updateOne(
    { _id: account._id },
    {
      $set: { status: "active", deletionRequestedAt: null, purgeAfter: null },
    },
  );

  return { status: "active", deletionRequestedAt: null, purgeAfter: null };
};

export const countAccountData = async (
  accountId: Types.ObjectId,
): Promise<Record<string, number>> => ({
  vehicles: await vehicleRepository.count({ accountId }),
  planItems: await planItemRepository.count({ accountId }),
  odometerReadings: await odometerReadingRepository.count({ accountId }),
  maintenanceEvents: await maintenanceEventRepository.count({ accountId }),
  notifications: await notificationRepository.count({ accountId }),
});
