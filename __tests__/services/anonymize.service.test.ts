import { Types } from "mongoose";

const repositoryMock = () => ({
  find: jest.fn(),
  count: jest.fn(),
  deleteMany: jest.fn(),
  updateOne: jest.fn(),
});

jest.mock("../../src/repositories/account.repository", () => ({
  accountRepository: { find: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../src/repositories/user.repository", () => ({
  userRepository: { find: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../src/repositories/vehicle.repository", () => ({
  vehicleRepository: { count: jest.fn(), deleteMany: jest.fn() },
}));
jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: { deleteMany: jest.fn() },
}));
jest.mock("../../src/repositories/odometerReading.repository", () => ({
  odometerReadingRepository: { deleteMany: jest.fn() },
}));
jest.mock("../../src/repositories/maintenanceEvent.repository", () => ({
  maintenanceEventRepository: { deleteMany: jest.fn() },
}));
jest.mock("../../src/repositories/attachment.repository", () => ({
  attachmentRepository: { find: jest.fn(), deleteMany: jest.fn() },
}));
jest.mock("../../src/repositories/alert.repository", () => ({
  alertRepository: { deleteMany: jest.fn() },
}));
jest.mock("../../src/repositories/notification.repository", () => ({
  notificationRepository: { deleteMany: jest.fn() },
}));
jest.mock("../../src/repositories/pushDevice.repository", () => ({
  pushDeviceRepository: { deleteMany: jest.fn() },
}));
jest.mock("../../src/libs/s3", () => ({ deleteObject: jest.fn() }));

import { accountRepository } from "../../src/repositories/account.repository";
import { userRepository } from "../../src/repositories/user.repository";
import { vehicleRepository } from "../../src/repositories/vehicle.repository";
import { attachmentRepository } from "../../src/repositories/attachment.repository";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { pushDeviceRepository } from "../../src/repositories/pushDevice.repository";
import { deleteObject } from "../../src/libs/s3";
import {
  ANONYMIZED_NAME,
  runAnonymizeAccounts,
} from "../../src/services/purge/anonymize.service";

const accountId = new Types.ObjectId();
const userId = new Types.ObjectId();
const reference = new Date("2026-09-19T09:00:00.000Z");

beforeEach(() => {
  (accountRepository.find as jest.Mock).mockResolvedValue([
    { _id: accountId, status: "pending_deletion" },
  ]);
  (userRepository.find as jest.Mock).mockResolvedValue([
    { _id: userId, email: "vitor@example.com" },
  ]);
  (attachmentRepository.find as jest.Mock).mockResolvedValue([]);
  (vehicleRepository.count as jest.Mock).mockResolvedValue(2);
});

describe("runAnonymizeAccounts", () => {
  it("pega só conta com carência vencida", async () => {
    await runAnonymizeAccounts(reference);

    expect((accountRepository.find as jest.Mock).mock.calls[0][0]).toEqual({
      status: "pending_deletion",
      purgeAfter: { $ne: null, $lte: reference },
    });
  });

  it("apaga os dados do veículo e desinscreve os dispositivos", async () => {
    const result = await runAnonymizeAccounts(reference);

    expect(planItemRepository.deleteMany).toHaveBeenCalledWith({ accountId });
    expect(vehicleRepository.deleteMany).toHaveBeenCalledWith({ accountId });
    expect(pushDeviceRepository.deleteMany).toHaveBeenCalledWith({ accountId });
    expect(result.vehiclesRemoved).toBe(2);
  });

  it("anonimiza o usuário sem apagar a linha", async () => {
    const result = await runAnonymizeAccounts(reference);

    const update = (userRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update.name).toBe(ANONYMIZED_NAME);
    expect(update.email).toBe(`removed-${userId}@removed.healthcar.invalid`);
    expect(update.phone).toBeNull();
    expect(update.cognitoSub).toBe(`removed-${userId}`);
    expect(update.anonymizedAt).toEqual(reference);
    expect(result.usersAnonymized).toBe(1);
  });

  it("marca a conta como anonimizada e zera a carência", async () => {
    const result = await runAnonymizeAccounts(reference);

    const update = (accountRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update).toEqual({
      status: "anonymized",
      name: ANONYMIZED_NAME,
      purgeAfter: null,
    });
    expect(result.accountsAnonymized).toBe(1);
  });

  it("apaga os anexos do S3 antes de apagar os registros", async () => {
    (attachmentRepository.find as jest.Mock).mockResolvedValue([
      { _id: new Types.ObjectId(), s3Key: "accounts/a/1.pdf" },
    ]);

    const result = await runAnonymizeAccounts(reference);

    expect(deleteObject).toHaveBeenCalledWith("accounts/a/1.pdf");
    expect(result.objectsRemoved).toBe(1);
    expect(attachmentRepository.deleteMany).toHaveBeenCalledWith({ accountId });
  });

  it("segue anonimizando mesmo se o S3 falhar", async () => {
    (attachmentRepository.find as jest.Mock).mockResolvedValue([
      { _id: new Types.ObjectId(), s3Key: "accounts/a/1.pdf" },
    ]);
    (deleteObject as jest.Mock).mockRejectedValue(new Error("access denied"));

    const result = await runAnonymizeAccounts(reference);

    expect(result.objectFailures).toBe(1);
    expect(result.accountsAnonymized).toBe(1);
  });

  it("isola a falha de uma conta das demais", async () => {
    (accountRepository.find as jest.Mock).mockResolvedValue([
      { _id: accountId },
      { _id: new Types.ObjectId() },
    ]);
    (vehicleRepository.count as jest.Mock)
      .mockRejectedValueOnce(new Error("mongo caiu"))
      .mockResolvedValueOnce(0);

    const result = await runAnonymizeAccounts(reference);

    expect(result.failures).toBe(1);
    expect(result.accountsAnonymized).toBe(1);
  });
});
