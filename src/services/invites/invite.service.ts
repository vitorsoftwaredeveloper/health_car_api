import { Types } from "mongoose";
import { deleteCognitoUser, inviteCognitoUser } from "../../libs/cognito";
import { withTransaction } from "../../libs/mongo";
import { userRepository } from "../../repositories/user.repository";
import { vehicleRepository } from "../../repositories/vehicle.repository";
import { pushDeviceRepository } from "../../repositories/pushDevice.repository";
import { Requester, UserDocument } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { defaultPreferences } from "../../domain/preferences";
import {
  DUPLICATE_KEY_ERROR_CODE,
  httpError,
  STATUS_CODE,
} from "../../utils/errors";

export interface InviteDriverPayload {
  email: string;
  name?: string;
  vehicleIds: string[];
}

export interface DriverView {
  userId: string;
  name: string;
  email: string;
  invitedAt: Date | null;
  vehicles: { id: string; nickname: string }[];
}

const nameFromEmail = (email: string): string => {
  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.join(" ") || "Condutor";
};

const assertIsOwner = (requester: Requester): void => {
  if (requester.role !== "owner") {
    throw httpError(
      STATUS_CODE.FORBIDDEN,
      "FORBIDDEN",
      "Só o proprietário pode convidar condutores.",
    );
  }
};

const loadAccountVehicles = async (
  requester: Requester,
  vehicleIds: string[],
): Promise<VehicleDocument[]> => {
  if (vehicleIds.some((id) => !Types.ObjectId.isValid(id))) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "VEHICLE_NOT_FOUND",
      "Veículo não encontrado.",
    );
  }

  const vehicles = (await vehicleRepository.find({
    _id: { $in: vehicleIds.map((id) => new Types.ObjectId(id)) },
    accountId: requester.accountId,
  })) as VehicleDocument[];

  if (vehicles.length !== new Set(vehicleIds).size) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "VEHICLE_NOT_FOUND",
      "Veículo não encontrado nesta conta.",
    );
  }

  return vehicles;
};

const toDriverView = (
  user: UserDocument,
  vehicles: VehicleDocument[],
): DriverView => ({
  userId: String(user._id),
  name: user.name,
  email: user.email,
  invitedAt: user.createdAt ?? null,
  vehicles: vehicles
    .filter((vehicle) =>
      vehicle.drivers.some(
        (driver) => String(driver.userId) === String(user._id),
      ),
    )
    .map((vehicle) => ({ id: String(vehicle._id), nickname: vehicle.nickname })),
});

export const listDrivers = async (
  requester: Requester,
): Promise<DriverView[]> => {
  const [drivers, vehicles] = await Promise.all([
    userRepository.find({
      accountId: requester.accountId,
      role: "driver",
    }) as Promise<UserDocument[]>,
    vehicleRepository.find({
      accountId: requester.accountId,
    }) as Promise<VehicleDocument[]>,
  ]);

  return drivers.map((driver) => toDriverView(driver, vehicles));
};

export const inviteDriver = async (
  requester: Requester,
  payload: InviteDriverPayload,
): Promise<DriverView> => {
  assertIsOwner(requester);

  const email = payload.email.trim().toLowerCase();
  const vehicles = await loadAccountVehicles(requester, payload.vehicleIds);

  if (email === requester.user.email) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "CANNOT_INVITE_YOURSELF",
      "Você já é o proprietário desta conta.",
    );
  }

  const existing = (await userRepository.findOne({
    email,
  })) as UserDocument | null;

  if (existing && String(existing.accountId) !== String(requester.accountId)) {
    throw httpError(
      STATUS_CODE.CONFLICT,
      "EMAIL_ALREADY_REGISTERED",
      "Este e-mail já está vinculado a outra conta.",
    );
  }

  const name = payload.name?.trim() || nameFromEmail(email);
  const vehicleIds = vehicles.map((vehicle) => vehicle._id);

  const driverId = existing?._id ?? new Types.ObjectId();

  if (!existing) {
    const { cognitoSub, alreadyExisted } = await inviteCognitoUser(
      email,
      name,
      "driver",
    );

    if (alreadyExisted) {
      throw httpError(
        STATUS_CODE.CONFLICT,
        "EMAIL_ALREADY_REGISTERED",
        "Este e-mail já tem acesso ao sistema.",
      );
    }

    try {
      await userRepository.insertOne({
        _id: driverId,
        accountId: requester.accountId,
        cognitoSub,
        name,
        email,
        role: "driver",
        preferences: defaultPreferences(),
      });
    } catch (error: any) {
      if (error?.code !== DUPLICATE_KEY_ERROR_CODE) throw error;
      throw httpError(
        STATUS_CODE.CONFLICT,
        "EMAIL_ALREADY_REGISTERED",
        "Este e-mail já tem acesso ao sistema.",
      );
    }
  }

  await vehicleRepository.updateMany(
    { _id: { $in: vehicleIds }, "drivers.userId": { $ne: driverId } },
    {
      $push: {
        drivers: { userId: driverId, role: "driver", addedAt: new Date() },
      },
    },
  );

  const driver = (await userRepository.findOne({
    _id: driverId,
  })) as UserDocument;

  const refreshed = (await vehicleRepository.find({
    accountId: requester.accountId,
  })) as VehicleDocument[];

  return toDriverView(driver, refreshed);
};

export const revokeDriver = async (
  requester: Requester,
  driverId: string,
): Promise<void> => {
  assertIsOwner(requester);

  if (!Types.ObjectId.isValid(driverId)) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "DRIVER_NOT_FOUND",
      "Condutor não encontrado.",
    );
  }

  const driver = (await userRepository.findOne({
    _id: new Types.ObjectId(driverId),
    accountId: requester.accountId,
    role: "driver",
  })) as UserDocument | null;

  if (!driver) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "DRIVER_NOT_FOUND",
      "Condutor não encontrado.",
    );
  }

  await withTransaction(async (session) => {
    await vehicleRepository.updateMany(
      { accountId: requester.accountId },
      { $pull: { drivers: { userId: driver._id } } },
      { session },
    );

    await pushDeviceRepository.deleteMany({ userId: driver._id }, { session });
    await userRepository.deleteOne({ _id: driver._id }, { session });
  });

  await deleteCognitoUser(driver.email);
};
