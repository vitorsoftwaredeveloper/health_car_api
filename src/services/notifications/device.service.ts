import { Types } from "mongoose";
import { pushDeviceRepository } from "../../repositories/pushDevice.repository";
import { PushDeviceDocument } from "../../types/notification";
import { Requester } from "../../types/user";
import { httpError, STATUS_CODE } from "../../utils/errors";

export interface RegisterDevicePayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
  standalone?: boolean;
}

export interface DeviceView {
  id: string;
  endpoint: string;
  standalone: boolean;
  active: boolean;
  createdAt: Date | null;
}

const toDeviceView = (device: PushDeviceDocument): DeviceView => ({
  id: String(device._id),
  endpoint: device.endpoint,
  standalone: device.standalone,
  active: device.active,
  createdAt: device.createdAt ?? null,
});

export const registerDevice = async (
  requester: Requester,
  payload: RegisterDevicePayload,
): Promise<DeviceView> => {
  const device = (await pushDeviceRepository.findOneAndUpdate(
    { endpoint: payload.endpoint },
    {
      $set: {
        accountId: requester.accountId,
        userId: requester.userId,
        keys: payload.keys,
        userAgent: payload.userAgent ?? null,
        standalone: payload.standalone ?? false,
        active: true,
      },
    },
    { upsert: true },
  )) as unknown as PushDeviceDocument;

  return toDeviceView(device);
};

export const removeDevice = async (
  requester: Requester,
  deviceId: string,
): Promise<void> => {
  if (!Types.ObjectId.isValid(deviceId)) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "DEVICE_NOT_FOUND",
      "Dispositivo não encontrado.",
    );
  }

  const removed = await pushDeviceRepository.deleteOne({
    _id: new Types.ObjectId(deviceId),
    userId: requester.userId,
  });

  if (!removed.deletedCount) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "DEVICE_NOT_FOUND",
      "Dispositivo não encontrado.",
    );
  }
};
