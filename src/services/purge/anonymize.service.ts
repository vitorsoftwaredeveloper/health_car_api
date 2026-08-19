import { Types } from "mongoose";
import { deleteObject } from "../../libs/s3";
import { accountRepository } from "../../repositories/account.repository";
import { alertRepository } from "../../repositories/alert.repository";
import { attachmentRepository } from "../../repositories/attachment.repository";
import { maintenanceEventRepository } from "../../repositories/maintenanceEvent.repository";
import { notificationRepository } from "../../repositories/notification.repository";
import { odometerReadingRepository } from "../../repositories/odometerReading.repository";
import { planItemRepository } from "../../repositories/planItem.repository";
import { pushDeviceRepository } from "../../repositories/pushDevice.repository";
import { userRepository } from "../../repositories/user.repository";
import { vehicleRepository } from "../../repositories/vehicle.repository";
import { AttachmentDocument } from "../../types/maintenance";
import { AccountDocument, UserDocument } from "../../types/user";

const PAGE_SIZE = 20;

export const ANONYMIZED_NAME = "Usuário removido";
export const ANONYMIZED_EMAIL_DOMAIN = "removed.healthcar.invalid";

export interface AnonymizeAccountsResult {
  accountsAnonymized: number;
  usersAnonymized: number;
  vehiclesRemoved: number;
  objectsRemoved: number;
  objectFailures: number;
  failures: number;
}

const removeAccountData = async (
  accountId: Types.ObjectId,
  result: AnonymizeAccountsResult,
): Promise<void> => {
  const attachments = (await attachmentRepository.find({
    accountId,
  })) as AttachmentDocument[];

  for (const attachment of attachments) {
    try {
      await deleteObject(attachment.s3Key);
      result.objectsRemoved += 1;
    } catch (error: any) {
      result.objectFailures += 1;
      console.error("attachment object removal failed", {
        attachmentId: String(attachment._id),
        message: error?.message,
      });
    }
  }

  const vehicles = await vehicleRepository.count({ accountId });
  result.vehiclesRemoved += vehicles;

  const scope = { accountId };
  await attachmentRepository.deleteMany(scope);
  await maintenanceEventRepository.deleteMany(scope);
  await planItemRepository.deleteMany(scope);
  await odometerReadingRepository.deleteMany(scope);
  await alertRepository.deleteMany(scope);
  await notificationRepository.deleteMany(scope);
  await vehicleRepository.deleteMany(scope);
  await pushDeviceRepository.deleteMany(scope);
};

const anonymizeUsers = async (
  accountId: Types.ObjectId,
  anonymizedAt: Date,
): Promise<number> => {
  const users = (await userRepository.find({ accountId })) as UserDocument[];

  for (const user of users) {
    await userRepository.updateOne(
      { _id: user._id },
      {
        $set: {
          name: ANONYMIZED_NAME,
          email: `removed-${String(user._id)}@${ANONYMIZED_EMAIL_DOMAIN}`,
          phone: null,
          cognitoSub: `removed-${String(user._id)}`,
          anonymizedAt,
        },
      },
    );
  }

  return users.length;
};

export const runAnonymizeAccounts = async (
  reference: Date = new Date(),
): Promise<AnonymizeAccountsResult> => {
  const result: AnonymizeAccountsResult = {
    accountsAnonymized: 0,
    usersAnonymized: 0,
    vehiclesRemoved: 0,
    objectsRemoved: 0,
    objectFailures: 0,
    failures: 0,
  };

  const accounts = (await accountRepository.find(
    { status: "pending_deletion", purgeAfter: { $ne: null, $lte: reference } },
    null,
    { limit: PAGE_SIZE },
  )) as AccountDocument[];

  for (const account of accounts) {
    const accountId = account._id as Types.ObjectId;

    try {
      await removeAccountData(accountId, result);
      result.usersAnonymized += await anonymizeUsers(accountId, reference);

      await accountRepository.updateOne(
        { _id: accountId },
        {
          $set: {
            status: "anonymized",
            name: ANONYMIZED_NAME,
            purgeAfter: null,
          },
        },
      );

      result.accountsAnonymized += 1;
    } catch (error: any) {
      result.failures += 1;
      console.error("account anonymization failed", {
        accountId: String(accountId),
        message: error?.message,
      });
    }
  }

  return result;
};
