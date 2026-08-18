import { Types } from "mongoose";
import { odometerReadingRepository } from "../../repositories/odometerReading.repository";
import { OdometerReadingDocument, OdometerSource } from "../../types/odometer";
import { Requester } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { parseLocalDate, today } from "../../utils/date";
import { httpError, STATUS_CODE } from "../../utils/errors";
import { assertVehicleAccess } from "../vehicles/access.service";
import {
  ItemStatusChange,
  recalculateVehicle,
} from "../plan/recalculate.service";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export interface CreateOdometerReadingPayload {
  km: number;
  date?: string;
  source?: Extract<OdometerSource, "manual" | "refuel">;
}

export interface CorrectOdometerReadingPayload {
  km: number;
  date?: string;
}

export interface ListOdometerReadingsQuery {
  limit?: number;
  before?: string;
}

export interface OdometerReadingView {
  id: string;
  km: number;
  date: Date;
  source: OdometerSource;
  correctsId: string | null;
  createdAt: Date | null;
}

export interface OdometerReadingResult {
  reading: OdometerReadingView;
  kmPerDay: number;
  estimatedOdometer: number;
  healthScore: number;
  changedItems: ItemStatusChange[];
}

const toReadingView = (
  reading: OdometerReadingDocument,
): OdometerReadingView => ({
  id: String(reading._id),
  km: reading.km,
  date: reading.date,
  source: reading.source,
  correctsId: reading.correctsId ? String(reading.correctsId) : null,
  createdAt: reading.createdAt ?? null,
});

const parseDate = (value?: string): Date =>
  value ? parseLocalDate(value) : today();

const assertNotInFuture = (date: Date): void => {
  if (date.getTime() > today().getTime()) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "FUTURE_DATE",
      "A data da leitura não pode estar no futuro.",
    );
  }
};

const assertMonotonic = async (
  vehicle: VehicleDocument,
  km: number,
  date: Date,
): Promise<void> => {
  const [previous] = (await odometerReadingRepository.find(
    { vehicleId: vehicle._id, date: { $lte: date } },
    null,
    { sort: { date: -1, createdAt: -1 }, limit: 1 },
  )) as OdometerReadingDocument[];

  if (previous && km < previous.km) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "ODOMETER_REGRESSION",
      `A última leitura registrada é de ${previous.km} km. Para corrigir um valor errado, use a correção de leitura.`,
    );
  }

  const [next] = (await odometerReadingRepository.find(
    { vehicleId: vehicle._id, date: { $gt: date } },
    null,
    { sort: { date: 1, createdAt: 1 }, limit: 1 },
  )) as OdometerReadingDocument[];

  if (next && km > next.km) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "ODOMETER_REGRESSION",
      `Já existe uma leitura posterior com ${next.km} km. A quilometragem informada deixaria a série inconsistente.`,
    );
  }
};

const persistAndRecalculate = async (
  vehicle: VehicleDocument,
  document: OdometerReadingDocument,
): Promise<OdometerReadingResult> => {
  const created = await odometerReadingRepository.insertOne(document);
  const recalculation = await recalculateVehicle(vehicle);

  return {
    reading: toReadingView(created.toObject() as OdometerReadingDocument),
    kmPerDay: recalculation.kmPerDay,
    estimatedOdometer: recalculation.estimatedOdometer,
    healthScore: recalculation.healthScore,
    changedItems: recalculation.changedItems,
  };
};

export const createOdometerReading = async (
  requester: Requester,
  vehicleId: string,
  payload: CreateOdometerReadingPayload,
): Promise<OdometerReadingResult> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "write");
  const date = parseDate(payload.date);

  assertNotInFuture(date);
  await assertMonotonic(vehicle, payload.km, date);

  return persistAndRecalculate(vehicle, {
    _id: new Types.ObjectId(),
    accountId: vehicle.accountId,
    vehicleId: vehicle._id as Types.ObjectId,
    km: payload.km,
    date,
    source: payload.source ?? "manual",
    createdBy: requester.userId,
  } as OdometerReadingDocument);
};

export const correctOdometerReading = async (
  requester: Requester,
  vehicleId: string,
  readingId: string,
  payload: CorrectOdometerReadingPayload,
): Promise<OdometerReadingResult> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");

  if (!Types.ObjectId.isValid(readingId)) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "READING_NOT_FOUND",
      "Leitura não encontrada.",
    );
  }

  const original = (await odometerReadingRepository.findOne({
    _id: new Types.ObjectId(readingId),
    vehicleId: vehicle._id,
  })) as OdometerReadingDocument | null;

  if (!original) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "READING_NOT_FOUND",
      "Leitura não encontrada.",
    );
  }

  if (original.source === "correction") {
    throw httpError(
      STATUS_CODE.CONFLICT,
      "READING_ALREADY_CORRECTED",
      "Esta leitura já é uma correção.",
    );
  }

  const date = payload.date ? parseDate(payload.date) : original.date;
  assertNotInFuture(date);

  return persistAndRecalculate(vehicle, {
    _id: new Types.ObjectId(),
    accountId: vehicle.accountId,
    vehicleId: vehicle._id as Types.ObjectId,
    km: payload.km,
    date,
    source: "correction",
    correctsId: original._id,
    createdBy: requester.userId,
  } as OdometerReadingDocument);
};

export const listOdometerReadings = async (
  requester: Requester,
  vehicleId: string,
  query: ListOdometerReadingsQuery,
): Promise<{ readings: OdometerReadingView[]; nextCursor: string | null }> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "read");

  const limit = Math.min(query.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const filter: Record<string, unknown> = { vehicleId: vehicle._id };

  if (query.before) {
    filter.date = { $lt: new Date(query.before) };
  }

  const readings = (await odometerReadingRepository.find(filter, null, {
    sort: { date: -1, createdAt: -1 },
    limit: limit + 1,
  })) as OdometerReadingDocument[];

  const page = readings.slice(0, limit);
  const nextCursor =
    readings.length > limit && page.length
      ? (page[page.length - 1] as OdometerReadingDocument).date.toISOString()
      : null;

  return { readings: page.map(toReadingView), nextCursor };
};
