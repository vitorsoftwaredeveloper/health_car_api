import { Types } from "mongoose";
import { KM_PER_DAY_FALLBACK } from "../../domain/constants";
import { isValidPlate, normalizePlate } from "../../domain/plate";
import { decrypt, encrypt, hashForLookup } from "../../libs/crypto";
import { accountRepository } from "../../repositories/account.repository";
import { vehicleRepository } from "../../repositories/vehicle.repository";
import { Requester } from "../../types/user";
import {
  Fuel,
  Transmission,
  VehicleDocument,
  VehicleStatus,
} from "../../types/vehicle";
import {
  DUPLICATE_KEY_ERROR_CODE,
  httpError,
  STATUS_CODE,
} from "../../utils/errors";
import { withTransaction } from "../../libs/mongo";
import { parseLocalDate, today } from "../../utils/date";
import { odometerReadingRepository } from "../../repositories/odometerReading.repository";
import { applyTemplateToVehicle, ApplyTemplateResult } from "../plan/plan.service";
import { assertVehicleAccess } from "./access.service";

export interface CreateVehiclePayload {
  nickname: string;
  make: string;
  model: string;
  trim?: string | null;
  manufactureYear: number;
  modelYear: number;
  engine?: string | null;
  fuel: Fuel;
  transmission?: Transmission | null;
  plate: string;
  vin?: string | null;
  color?: string | null;
  currentOdometer: number;
  currentOdometerAt?: string;
  applyTemplate?: boolean;
}

export interface UpdateVehiclePayload {
  nickname: string;
  make: string;
  model: string;
  trim?: string | null;
  manufactureYear: number;
  modelYear: number;
  engine?: string | null;
  fuel: Fuel;
  transmission?: Transmission | null;
  plate: string;
  vin?: string | null;
  color?: string | null;
  status?: VehicleStatus;
}

export interface VehicleView {
  id: string;
  nickname: string;
  make: string;
  model: string;
  trim: string | null;
  manufactureYear: number;
  modelYear: number;
  engine: string | null;
  fuel: Fuel;
  transmission: Transmission | null;
  plate: string;
  vin: string | null;
  color: string | null;
  photoKey: string | null;
  currentOdometer: number;
  currentOdometerAt: Date;
  kmPerDay: number;
  healthScore: number;
  status: VehicleStatus;
  driverCount: number;
  createdAt: Date | null;
}

const assertValidPlate = (plate: string): string => {
  if (!isValidPlate(plate)) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "INVALID_PLATE",
      "Placa inválida. Use o padrão Mercosul (ABC1D23) ou o antigo (ABC1234).",
    );
  }
  return normalizePlate(plate);
};

const assertConsistentYears = (
  manufactureYear: number,
  modelYear: number,
): void => {
  if (modelYear < manufactureYear || modelYear > manufactureYear + 1) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "INCONSISTENT_MODEL_YEAR",
      "Ano do modelo deve ser igual ao de fabricação ou um ano à frente.",
    );
  }
};

const duplicatePlate = () =>
  httpError(
    STATUS_CODE.CONFLICT,
    "PLATE_ALREADY_REGISTERED",
    "Já existe um veículo com esta placa na conta.",
  );

export const toVehicleView = async (
  vehicle: VehicleDocument,
): Promise<VehicleView> => ({
  id: String(vehicle._id),
  nickname: vehicle.nickname,
  make: vehicle.make,
  model: vehicle.model,
  trim: vehicle.trim ?? null,
  manufactureYear: vehicle.manufactureYear,
  modelYear: vehicle.modelYear,
  engine: vehicle.engine ?? null,
  fuel: vehicle.fuel,
  transmission: vehicle.transmission ?? null,
  plate: await decrypt(vehicle.plate),
  vin: vehicle.vin ? await decrypt(vehicle.vin) : null,
  color: vehicle.color ?? null,
  photoKey: vehicle.photoKey ?? null,
  currentOdometer: vehicle.currentOdometer,
  currentOdometerAt: vehicle.currentOdometerAt,
  kmPerDay: vehicle.kmPerDay,
  healthScore: vehicle.healthScore,
  status: vehicle.status,
  driverCount: vehicle.drivers.length,
  createdAt: vehicle.createdAt ?? null,
});

const assertVehicleLimit = async (requester: Requester): Promise<void> => {
  const account = await accountRepository.findById(requester.accountId);
  const limit = (account as any)?.vehicleLimit ?? 3;
  const current = await vehicleRepository.count({
    accountId: requester.accountId,
  });

  if (current >= limit) {
    throw httpError(
      STATUS_CODE.CONFLICT,
      "VEHICLE_LIMIT_REACHED",
      `Sua conta permite no máximo ${limit} veículos.`,
    );
  }
};

export const listVehicles = async (
  requester: Requester,
): Promise<VehicleView[]> => {
  const vehicles = (await vehicleRepository.find(
    {
      $or: [
        { accountId: requester.accountId },
        { "drivers.userId": requester.userId },
      ],
    },
    null,
    { sort: { createdAt: 1 } },
  )) as VehicleDocument[];

  return Promise.all(vehicles.map(toVehicleView));
};

export const getVehicle = async (
  requester: Requester,
  vehicleId: string,
): Promise<VehicleView> =>
  toVehicleView(await assertVehicleAccess(requester, vehicleId, "read"));

export interface CreatedVehicleView extends VehicleView {
  plan: ApplyTemplateResult;
}

export const createVehicle = async (
  requester: Requester,
  payload: CreateVehiclePayload,
): Promise<CreatedVehicleView> => {
  await assertVehicleLimit(requester);

  const plate = assertValidPlate(payload.plate);
  assertConsistentYears(payload.manufactureYear, payload.modelYear);

  const document = {
    _id: new Types.ObjectId(),
    accountId: requester.accountId,
    nickname: payload.nickname.trim(),
    make: payload.make.trim(),
    model: payload.model.trim(),
    trim: payload.trim ?? null,
    manufactureYear: payload.manufactureYear,
    modelYear: payload.modelYear,
    engine: payload.engine ?? null,
    fuel: payload.fuel,
    transmission: payload.transmission ?? null,
    plate: await encrypt(plate),
    plateHash: await hashForLookup(plate),
    vin: payload.vin ? await encrypt(payload.vin.trim().toUpperCase()) : null,
    color: payload.color ?? null,
    currentOdometer: payload.currentOdometer,
    currentOdometerAt: payload.currentOdometerAt
      ? parseLocalDate(payload.currentOdometerAt)
      : today(),
    kmPerDay: KM_PER_DAY_FALLBACK,
    healthScore: 100,
    drivers: [
      { userId: requester.userId, role: requester.role, addedAt: new Date() },
    ],
    status: "active" as VehicleStatus,
  };

  const shouldApplyTemplate = payload.applyTemplate !== false;

  try {
    const { vehicle, plan } = await withTransaction(async (session) => {
      const created = await vehicleRepository.insertOne(document, { session });
      const persisted = created.toObject() as VehicleDocument;

      await odometerReadingRepository.insertOne(
        {
          accountId: persisted.accountId,
          vehicleId: persisted._id,
          km: persisted.currentOdometer,
          date: persisted.currentOdometerAt,
          source: "manual",
          createdBy: requester.userId,
        },
        { session },
      );

      return {
        vehicle: persisted,
        plan: shouldApplyTemplate
          ? await applyTemplateToVehicle(persisted, session)
          : { templateName: null, created: 0, skipped: 0 },
      };
    });

    return { ...(await toVehicleView(vehicle)), plan };
  } catch (error: any) {
    if (error?.code === DUPLICATE_KEY_ERROR_CODE) throw duplicatePlate();
    throw error;
  }
};

export const updateVehicle = async (
  requester: Requester,
  vehicleId: string,
  payload: UpdateVehiclePayload,
): Promise<VehicleView> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");

  const plate = assertValidPlate(payload.plate);
  assertConsistentYears(payload.manufactureYear, payload.modelYear);

  const update = {
    nickname: payload.nickname.trim(),
    make: payload.make.trim(),
    model: payload.model.trim(),
    trim: payload.trim ?? null,
    manufactureYear: payload.manufactureYear,
    modelYear: payload.modelYear,
    engine: payload.engine ?? null,
    fuel: payload.fuel,
    transmission: payload.transmission ?? null,
    plate: await encrypt(plate),
    plateHash: await hashForLookup(plate),
    vin: payload.vin ? await encrypt(payload.vin.trim().toUpperCase()) : null,
    color: payload.color ?? null,
    status: payload.status ?? vehicle.status,
  };

  try {
    const updated = (await vehicleRepository.findOneAndUpdate(
      { _id: vehicle._id },
      { $set: update },
    )) as unknown as VehicleDocument | null;

    if (!updated) {
      throw httpError(
        STATUS_CODE.NOT_FOUND,
        "VEHICLE_NOT_FOUND",
        "Veículo não encontrado.",
      );
    }

    return toVehicleView(updated);
  } catch (error: any) {
    if (error?.code === DUPLICATE_KEY_ERROR_CODE) throw duplicatePlate();
    throw error;
  }
};

export const deleteVehicle = async (
  requester: Requester,
  vehicleId: string,
): Promise<void> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");
  await vehicleRepository.deleteOne({ _id: vehicle._id });
};
