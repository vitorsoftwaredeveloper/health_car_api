import { Types } from "mongoose";

jest.mock("../../src/repositories/account.repository", () => ({
  accountRepository: { findById: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../src/repositories/user.repository", () => ({
  userRepository: { find: jest.fn() },
}));
jest.mock("../../src/repositories/vehicle.repository", () => ({
  vehicleRepository: { find: jest.fn(), count: jest.fn() },
}));
jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: { find: jest.fn(), count: jest.fn() },
}));
jest.mock("../../src/repositories/odometerReading.repository", () => ({
  odometerReadingRepository: { find: jest.fn(), count: jest.fn() },
}));
jest.mock("../../src/repositories/maintenanceEvent.repository", () => ({
  maintenanceEventRepository: { find: jest.fn(), count: jest.fn() },
}));
jest.mock("../../src/repositories/attachment.repository", () => ({
  attachmentRepository: { find: jest.fn() },
}));
jest.mock("../../src/repositories/alert.repository", () => ({
  alertRepository: { find: jest.fn() },
}));
jest.mock("../../src/repositories/notification.repository", () => ({
  notificationRepository: { count: jest.fn() },
}));
jest.mock("../../src/libs/crypto", () => ({
  decrypt: jest.fn(async (value: string) => value.replace("ENC:", "")),
}));

import { accountRepository } from "../../src/repositories/account.repository";
import { userRepository } from "../../src/repositories/user.repository";
import { vehicleRepository } from "../../src/repositories/vehicle.repository";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { odometerReadingRepository } from "../../src/repositories/odometerReading.repository";
import { maintenanceEventRepository } from "../../src/repositories/maintenanceEvent.repository";
import { attachmentRepository } from "../../src/repositories/attachment.repository";
import { alertRepository } from "../../src/repositories/alert.repository";
import {
  cancelAccountDeletion,
  exportAccountData,
  requestAccountDeletion,
} from "../../src/services/users/lgpd.service";
import { PURGE_GRACE_DAYS } from "../../src/domain/retention";
import { Requester } from "../../src/types/user";

const accountId = new Types.ObjectId();
const userId = new Types.ObjectId();

const owner: Requester = { userId, accountId, role: "owner", user: {} as any };
const driver: Requester = {
  userId: new Types.ObjectId(),
  accountId,
  role: "driver",
  user: {} as any,
};

const account = (overrides: any = {}) => ({
  _id: accountId,
  name: "Vitor",
  ownerId: userId,
  plan: "free",
  vehicleLimit: 3,
  status: "active",
  ...overrides,
});

beforeEach(() => {
  (accountRepository.findById as jest.Mock).mockResolvedValue(account());
  (userRepository.find as jest.Mock).mockResolvedValue([
    {
      _id: userId,
      name: "Vitor",
      email: "vitor@example.com",
      phone: "ENC:+5585999990000",
      role: "owner",
      preferences: {},
    },
  ]);
  (vehicleRepository.find as jest.Mock).mockResolvedValue([
    {
      _id: new Types.ObjectId(),
      nickname: "Meu Civic",
      make: "Honda",
      model: "Civic",
      manufactureYear: 2019,
      modelYear: 2020,
      fuel: "flex",
      plate: "ENC:BRA2E19",
      vin: "ENC:9BWZZZ377VT004251",
      currentOdometer: 79010,
      currentOdometerAt: new Date(),
      healthScore: 80,
      status: "active",
    },
  ]);
  [planItemRepository, odometerReadingRepository, maintenanceEventRepository, attachmentRepository, alertRepository].forEach(
    (repository: any) => repository.find.mockResolvedValue([]),
  );
});

describe("exportAccountData", () => {
  it("devolve placa, VIN e telefone em claro para o titular", async () => {
    const data = (await exportAccountData(owner)) as any;

    expect(data.users[0].phone).toBe("+5585999990000");
    expect(data.vehicles[0].plate).toBe("BRA2E19");
    expect(data.vehicles[0].vin).toBe("9BWZZZ377VT004251");
    expect(data.exportedAt).toBeInstanceOf(Date);
  });

  it("escopa tudo pela conta do requisitante", async () => {
    await exportAccountData(owner);

    [userRepository, vehicleRepository, planItemRepository, alertRepository].forEach(
      (repository: any) => {
        expect(repository.find.mock.calls[0][0]).toEqual({ accountId });
      },
    );
  });

  it("traz as sete coleções do prontuário", async () => {
    const data = (await exportAccountData(owner)) as any;

    expect(Object.keys(data)).toEqual(
      expect.arrayContaining([
        "account",
        "users",
        "vehicles",
        "planItems",
        "odometerReadings",
        "maintenanceEvents",
        "attachments",
        "alerts",
      ]),
    );
  });

  it("falha quando a conta sumiu", async () => {
    (accountRepository.findById as jest.Mock).mockResolvedValue(null);

    await expect(exportAccountData(owner)).rejects.toMatchObject({
      statusCode: 404,
      code: "ACCOUNT_NOT_FOUND",
    });
  });
});

describe("requestAccountDeletion", () => {
  it("agenda a anonimização para daqui a 30 dias", async () => {
    const result = await requestAccountDeletion(owner);

    const update = (accountRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update.status).toBe("pending_deletion");

    const days = Math.round(
      (result.purgeAfter!.getTime() - result.deletionRequestedAt!.getTime()) /
        (24 * 60 * 60 * 1000),
    );
    expect(days).toBe(PURGE_GRACE_DAYS);
  });

  it("é idempotente enquanto o pedido está em andamento", async () => {
    const purgeAfter = new Date("2026-09-18T00:00:00.000Z");
    (accountRepository.findById as jest.Mock).mockResolvedValue(
      account({ status: "pending_deletion", purgeAfter, deletionRequestedAt: new Date() }),
    );

    const result = await requestAccountDeletion(owner);

    expect(accountRepository.updateOne).not.toHaveBeenCalled();
    expect(result.purgeAfter).toEqual(purgeAfter);
  });

  it("só o dono da conta pode pedir exclusão", async () => {
    await expect(requestAccountDeletion(driver)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });
});

describe("cancelAccountDeletion", () => {
  it("volta a conta para ativa e limpa a carência", async () => {
    (accountRepository.findById as jest.Mock).mockResolvedValue(
      account({ status: "pending_deletion", purgeAfter: new Date() }),
    );

    const result = await cancelAccountDeletion(owner);

    const update = (accountRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update).toEqual({
      status: "active",
      deletionRequestedAt: null,
      purgeAfter: null,
    });
    expect(result.status).toBe("active");
  });

  it("recusa cancelar quando não há pedido", async () => {
    await expect(cancelAccountDeletion(owner)).rejects.toMatchObject({
      statusCode: 409,
      code: "NO_DELETION_IN_PROGRESS",
    });
  });
});
