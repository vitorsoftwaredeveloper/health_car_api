import { Types } from "mongoose";

jest.mock("../../src/repositories/pushDevice.repository", () => ({
  pushDeviceRepository: { findOneAndUpdate: jest.fn(), deleteOne: jest.fn() },
}));

import { pushDeviceRepository } from "../../src/repositories/pushDevice.repository";
import {
  registerDevice,
  removeDevice,
} from "../../src/services/notifications/device.service";
import { Requester } from "../../src/types/user";

const userId = new Types.ObjectId();
const accountId = new Types.ObjectId();
const deviceId = new Types.ObjectId();

const requester: Requester = { userId, accountId, role: "owner", user: {} as any };

const payload = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "chave-publica", auth: "chave-auth" },
  userAgent: "Android Chrome",
  standalone: true,
};

beforeEach(() => {
  (pushDeviceRepository.findOneAndUpdate as jest.Mock).mockImplementation(
    async (_filter: any, update: any) => ({ _id: deviceId, ...update.$set }),
  );
  (pushDeviceRepository.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });
});

describe("registerDevice", () => {
  it("faz upsert pelo endpoint e reativa a inscrição", async () => {
    const view = await registerDevice(requester, payload);

    const [filter, update, options] = (
      pushDeviceRepository.findOneAndUpdate as jest.Mock
    ).mock.calls[0];

    expect(filter).toEqual({ endpoint: payload.endpoint });
    expect(update.$set).toMatchObject({
      userId,
      accountId,
      standalone: true,
      active: true,
    });
    expect(options).toEqual({ upsert: true });
    expect(view.standalone).toBe(true);
  });

  it("assume dispositivo fora do PWA quando não informado", async () => {
    await registerDevice(requester, { endpoint: payload.endpoint, keys: payload.keys });

    const update = (pushDeviceRepository.findOneAndUpdate as jest.Mock).mock.calls[0][1];
    expect(update.$set.standalone).toBe(false);
    expect(update.$set.userAgent).toBeNull();
  });
});

describe("removeDevice", () => {
  it("remove só dispositivo do próprio usuário", async () => {
    await removeDevice(requester, String(deviceId));

    expect((pushDeviceRepository.deleteOne as jest.Mock).mock.calls[0][0]).toEqual({
      _id: deviceId,
      userId,
    });
  });

  it("recusa id malformado", async () => {
    await expect(removeDevice(requester, "nao-e-id")).rejects.toMatchObject({
      statusCode: 404,
      code: "DEVICE_NOT_FOUND",
    });
  });

  it("recusa dispositivo de outro usuário", async () => {
    (pushDeviceRepository.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 0 });

    await expect(removeDevice(requester, String(deviceId))).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
