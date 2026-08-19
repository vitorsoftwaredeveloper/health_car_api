import { Types } from "mongoose";

jest.mock("../../src/libs/mongo", () => ({
  withTransaction: jest.fn((operation: any) => operation({ id: "session" })),
}));
jest.mock("../../src/libs/cognito", () => ({
  inviteCognitoUser: jest.fn(async () => ({
    cognitoSub: "cognito-sub-condutor",
    alreadyExisted: false,
  })),
  deleteCognitoUser: jest.fn(),
}));
jest.mock("../../src/repositories/user.repository", () => ({
  userRepository: {
    find: jest.fn(),
    findOne: jest.fn(),
    insertOne: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
jest.mock("../../src/repositories/vehicle.repository", () => ({
  vehicleRepository: { find: jest.fn(), updateMany: jest.fn() },
}));
jest.mock("../../src/repositories/pushDevice.repository", () => ({
  pushDeviceRepository: { deleteMany: jest.fn() },
}));

import { inviteCognitoUser, deleteCognitoUser } from "../../src/libs/cognito";
import { userRepository } from "../../src/repositories/user.repository";
import { vehicleRepository } from "../../src/repositories/vehicle.repository";
import { pushDeviceRepository } from "../../src/repositories/pushDevice.repository";
import {
  inviteDriver,
  listDrivers,
  revokeDriver,
} from "../../src/services/invites/invite.service";
import { Requester, UserDocument } from "../../src/types/user";
import { DUPLICATE_KEY_ERROR_CODE } from "../../src/utils/errors";

const accountId = new Types.ObjectId();
const ownerId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const driverId = new Types.ObjectId();

const owner: Requester = {
  userId: ownerId,
  accountId,
  role: "owner",
  user: { email: "ana@example.com" } as UserDocument,
};

const driverRequester: Requester = { ...owner, role: "driver" };

const vehicle = (overrides: any = {}) => ({
  _id: vehicleId,
  accountId,
  nickname: "Meu Civic",
  drivers: [],
  ...overrides,
});

const driverUser = {
  _id: driverId,
  accountId,
  name: "Bruno Souza",
  email: "bruno.souza@example.com",
  role: "driver",
};

beforeEach(() => {
  (vehicleRepository.find as jest.Mock).mockResolvedValue([vehicle()]);
  (userRepository.findOne as jest.Mock).mockResolvedValue(null);
  (userRepository.insertOne as jest.Mock).mockResolvedValue({});
});

describe("inviteDriver", () => {
  const payload = {
    email: "  Bruno.Souza@Example.com  ",
    vehicleIds: [String(vehicleId)],
  };

  it("provisiona no Cognito e cria o usuário condutor da conta", async () => {
    (userRepository.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(driverUser);

    const view = await inviteDriver(owner, payload);

    expect(inviteCognitoUser).toHaveBeenCalledWith(
      "bruno.souza@example.com",
      "Bruno Souza",
      "driver",
    );

    const created = (userRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(created).toMatchObject({
      accountId,
      cognitoSub: "cognito-sub-condutor",
      email: "bruno.souza@example.com",
      role: "driver",
    });
    expect(view.email).toBe("bruno.souza@example.com");
  });

  it("vincula o condutor só aos veículos escolhidos, sem duplicar", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(driverUser);

    await inviteDriver(owner, payload);

    const [filter, update] = (vehicleRepository.updateMany as jest.Mock).mock.calls[0];
    expect(filter["drivers.userId"]).toEqual({ $ne: driverUser._id });
    expect(update.$push.drivers).toMatchObject({ role: "driver" });
  });

  it("reaproveita condutor que já existe na conta", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(driverUser);

    await inviteDriver(owner, payload);

    expect(inviteCognitoUser).not.toHaveBeenCalled();
    expect(userRepository.insertOne).not.toHaveBeenCalled();
    expect(vehicleRepository.updateMany).toHaveBeenCalled();
  });

  it("recusa e-mail já vinculado a outra conta", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue({
      ...driverUser,
      accountId: new Types.ObjectId(),
    });

    await expect(inviteDriver(owner, payload)).rejects.toMatchObject({
      statusCode: 409,
      code: "EMAIL_ALREADY_REGISTERED",
    });
  });

  it("recusa quando o e-mail já existe no Cognito", async () => {
    (inviteCognitoUser as jest.Mock).mockResolvedValue({
      cognitoSub: "",
      alreadyExisted: true,
    });

    await expect(inviteDriver(owner, payload)).rejects.toMatchObject({
      statusCode: 409,
      code: "EMAIL_ALREADY_REGISTERED",
    });
    expect(userRepository.insertOne).not.toHaveBeenCalled();
  });

  it("traduz chave duplicada em conflito de e-mail", async () => {
    (userRepository.insertOne as jest.Mock).mockRejectedValue({
      code: DUPLICATE_KEY_ERROR_CODE,
    });

    await expect(inviteDriver(owner, payload)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("recusa convidar o próprio dono", async () => {
    await expect(
      inviteDriver(owner, { ...payload, email: "ana@example.com" }),
    ).rejects.toMatchObject({ statusCode: 422, code: "CANNOT_INVITE_YOURSELF" });
  });

  it("recusa veículo de outra conta", async () => {
    (vehicleRepository.find as jest.Mock).mockResolvedValue([]);

    await expect(inviteDriver(owner, payload)).rejects.toMatchObject({
      statusCode: 404,
      code: "VEHICLE_NOT_FOUND",
    });
  });

  it("recusa id de veículo malformado", async () => {
    await expect(
      inviteDriver(owner, { ...payload, vehicleIds: ["nao-e-id"] }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("condutor não convida ninguém", async () => {
    await expect(inviteDriver(driverRequester, payload)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });
});

describe("listDrivers", () => {
  it("lista condutores da conta com os veículos de cada um", async () => {
    (userRepository.find as jest.Mock).mockResolvedValue([driverUser]);
    (vehicleRepository.find as jest.Mock).mockResolvedValue([
      vehicle({ drivers: [{ userId: driverId }] }),
      vehicle({ _id: new Types.ObjectId(), nickname: "Gol", drivers: [] }),
    ]);

    const [view] = await listDrivers(owner);

    expect((userRepository.find as jest.Mock).mock.calls[0][0]).toEqual({
      accountId,
      role: "driver",
    });
    expect(view.vehicles).toEqual([{ id: String(vehicleId), nickname: "Meu Civic" }]);
  });
});

describe("revokeDriver", () => {
  beforeEach(() => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(driverUser);
  });

  it("desvincula de todos os veículos, apaga dispositivos e o usuário", async () => {
    await revokeDriver(owner, String(driverId));

    const [filter, update] = (vehicleRepository.updateMany as jest.Mock).mock.calls[0];
    expect(filter).toEqual({ accountId });
    expect(update.$pull.drivers).toEqual({ userId: driverId });

    expect(pushDeviceRepository.deleteMany).toHaveBeenCalledWith(
      { userId: driverId },
      { session: { id: "session" } },
    );
    expect(userRepository.deleteOne).toHaveBeenCalled();
    expect(deleteCognitoUser).toHaveBeenCalledWith("bruno.souza@example.com");
  });

  it("recusa condutor de outra conta", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(revokeDriver(owner, String(driverId))).rejects.toMatchObject({
      statusCode: 404,
      code: "DRIVER_NOT_FOUND",
    });
    expect(deleteCognitoUser).not.toHaveBeenCalled();
  });

  it("recusa id malformado", async () => {
    await expect(revokeDriver(owner, "nao-e-id")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("condutor não remove ninguém", async () => {
    await expect(
      revokeDriver(driverRequester, String(driverId)),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
