import { ClientSession, Types } from "mongoose";
import {
  acceptsFuelKind,
  allowedFuelKinds,
  FuelFill,
  FuelFillMetrics,
  FuelSummary,
  measureFills,
  summarizeFuel,
} from "../../domain/fuel";
import { withTransaction } from "../../libs/mongo";
import { fuelEntryRepository } from "../../repositories/fuelEntry.repository";
import { odometerReadingRepository } from "../../repositories/odometerReading.repository";
import { FuelEntryDocument, FuelKind } from "../../types/fuel";
import { OdometerReadingDocument } from "../../types/odometer";
import { Requester } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { parseLocalDate, today } from "../../utils/date";
import { httpError, STATUS_CODE } from "../../utils/errors";
import {
  assertMonotonic,
  assertNotInFuture,
} from "../odometer/odometer.service";
import {
  ItemStatusChange,
  recalculateVehicle,
} from "../plan/recalculate.service";
import { assertVehicleAccess } from "../vehicles/access.service";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;
const SUMMARY_WINDOW = 200;

export interface CreateFuelEntryPayload {
  date?: string;
  odometerKm: number;
  liters: number;
  fuelKind: FuelKind;
  totalCents?: number | null;
  fullTank?: boolean;
}

export interface ListFuelEntriesQuery {
  limit?: number;
  before?: string;
}

export interface FuelEntryView extends FuelFillMetrics {
  date: Date;
  odometerKm: number;
  liters: number;
  fuelKind: FuelKind;
  totalCents: number | null;
  fullTank: boolean;
  createdAt: Date | null;
}

export interface FuelOdometerEffect {
  kmPerDay: number;
  estimatedOdometer: number;
  healthScore: number;
  changedItems: ItemStatusChange[];
}

export interface CreateFuelEntryResult {
  entry: FuelEntryView;
  summary: FuelSummary;
  odometer: FuelOdometerEffect;
}

export interface FuelEntriesPage {
  entries: FuelEntryView[];
  summary: FuelSummary;
  nextCursor: string | null;
}

const entryNotFound = () =>
  httpError(
    STATUS_CODE.NOT_FOUND,
    "FUEL_ENTRY_NOT_FOUND",
    "Abastecimento não encontrado.",
  );

const toFill = (entry: FuelEntryDocument): FuelFill => ({
  id: String(entry._id),
  date: entry.date,
  odometerKm: entry.odometerKm,
  liters: entry.liters,
  fullTank: entry.fullTank,
  totalCents: entry.totalCents ?? null,
  fuelKind: entry.fuelKind,
});

const toViews = (entries: FuelEntryDocument[]): Map<string, FuelEntryView> => {
  const { metrics } = measureFills(entries.map(toFill));
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));

  return new Map(
    entries.map((entry) => {
      const id = String(entry._id);
      return [
        id,
        {
          ...(byId.get(id) as FuelFillMetrics),
          date: entry.date,
          odometerKm: entry.odometerKm,
          liters: entry.liters,
          fuelKind: entry.fuelKind,
          totalCents: entry.totalCents ?? null,
          fullTank: entry.fullTank,
          createdAt: entry.createdAt ?? null,
        },
      ];
    }),
  );
};

const loadRecent = async (
  vehicleId: Types.ObjectId,
  session?: ClientSession,
): Promise<FuelEntryDocument[]> =>
  (await fuelEntryRepository.find({ vehicleId }, null, {
    sort: { date: -1, odometerKm: -1 },
    limit: SUMMARY_WINDOW,
    session,
  })) as FuelEntryDocument[];

const assertFuelKind = (vehicle: VehicleDocument, fuelKind: FuelKind): void => {
  if (acceptsFuelKind(vehicle.fuel, fuelKind)) return;

  const allowed = allowedFuelKinds(vehicle.fuel);
  throw httpError(
    STATUS_CODE.UNPROCESSABLE_ENTITY,
    "FUEL_KIND_NOT_APPLICABLE",
    allowed.length
      ? "Este carro não usa esse combustível."
      : "Este veículo não abastece combustível.",
    { allowed },
  );
};

export const createFuelEntry = async (
  requester: Requester,
  vehicleId: string,
  payload: CreateFuelEntryPayload,
): Promise<CreateFuelEntryResult> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "write");
  const date = payload.date ? parseLocalDate(payload.date) : today();

  assertNotInFuture(date);
  assertFuelKind(vehicle, payload.fuelKind);
  await assertMonotonic(vehicle, payload.odometerKm, date);

  const entryId = new Types.ObjectId();
  const readingId = new Types.ObjectId();

  await withTransaction(async (session) => {
    await odometerReadingRepository.insertOne(
      {
        _id: readingId,
        accountId: vehicle.accountId,
        vehicleId: vehicle._id,
        km: payload.odometerKm,
        date,
        source: "refuel",
        referenceId: entryId,
        createdBy: requester.userId,
      } as OdometerReadingDocument,
      { session },
    );

    await fuelEntryRepository.insertOne(
      {
        _id: entryId,
        accountId: vehicle.accountId,
        vehicleId: vehicle._id,
        date,
        odometerKm: payload.odometerKm,
        liters: payload.liters,
        fuelKind: payload.fuelKind,
        totalCents: payload.totalCents ?? null,
        fullTank: payload.fullTank ?? true,
        odometerReadingId: readingId,
        createdBy: requester.userId,
      } as FuelEntryDocument,
      { session },
    );
  });

  const [recalculation, entries] = await Promise.all([
    recalculateVehicle(vehicle),
    loadRecent(vehicle._id as Types.ObjectId),
  ]);

  const views = toViews(entries);

  return {
    entry: views.get(String(entryId)) as FuelEntryView,
    summary: summarizeFuel(entries.map(toFill)),
    odometer: {
      kmPerDay: recalculation.kmPerDay,
      estimatedOdometer: recalculation.estimatedOdometer,
      healthScore: recalculation.healthScore,
      changedItems: recalculation.changedItems,
    },
  };
};

export const listFuelEntries = async (
  requester: Requester,
  vehicleId: string,
  query: ListFuelEntriesQuery = {},
): Promise<FuelEntriesPage> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "read");
  const limit = Math.min(query.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const recent = await loadRecent(vehicle._id as Types.ObjectId);
  const views = toViews(recent);

  const filter: Record<string, unknown> = { vehicleId: vehicle._id };
  if (query.before) filter.date = { $lt: new Date(query.before) };

  const page = (await fuelEntryRepository.find(filter, null, {
    sort: { date: -1, odometerKm: -1 },
    limit: limit + 1,
  })) as FuelEntryDocument[];

  const visible = page.slice(0, limit);
  const nextCursor =
    page.length > limit && visible.length
      ? visible[visible.length - 1].date.toISOString()
      : null;

  const pageViews = visible.map((entry) => {
    const id = String(entry._id);
    return views.get(id) ?? toViews([entry]).get(id) as FuelEntryView;
  });

  return {
    entries: pageViews,
    summary: summarizeFuel(recent.map(toFill)),
    nextCursor,
  };
};

export const deleteFuelEntry = async (
  requester: Requester,
  vehicleId: string,
  entryId: string,
): Promise<{ summary: FuelSummary; odometer: FuelOdometerEffect }> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");

  if (!Types.ObjectId.isValid(entryId)) throw entryNotFound();

  const entry = (await fuelEntryRepository.findOne({
    _id: new Types.ObjectId(entryId),
    vehicleId: vehicle._id,
  })) as FuelEntryDocument | null;

  if (!entry) throw entryNotFound();

  await withTransaction(async (session) => {
    await fuelEntryRepository.deleteOne({ _id: entry._id }, { session });
    if (entry.odometerReadingId) {
      await odometerReadingRepository.deleteOne(
        { _id: entry.odometerReadingId, source: "refuel" },
        { session },
      );
    }
  });

  const [recalculation, entries] = await Promise.all([
    recalculateVehicle(vehicle),
    loadRecent(vehicle._id as Types.ObjectId),
  ]);

  return {
    summary: summarizeFuel(entries.map(toFill)),
    odometer: {
      kmPerDay: recalculation.kmPerDay,
      estimatedOdometer: recalculation.estimatedOdometer,
      healthScore: recalculation.healthScore,
      changedItems: recalculation.changedItems,
    },
  };
};
