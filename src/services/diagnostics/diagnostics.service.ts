import { Types } from "mongoose";
import {
  doneItems,
  hasItem,
  mergeFindings,
  openItems,
  removeItem,
  setItemDone,
} from "../../domain/diagnostics";
import { diagnosticChecklistRepository } from "../../repositories/diagnosticChecklist.repository";
import { diagnosticSessionRepository } from "../../repositories/diagnosticSession.repository";
import {
  ChecklistFinding,
  ChecklistItem,
  DiagnosticChecklistDocument,
  DiagnosticMonitor,
  DiagnosticReading,
  DiagnosticSessionDocument,
  DiagnosticTrip,
  DiagnosticTripSummary,
  DiagnosticTroubleCodes,
} from "../../types/diagnostics";
import { Requester } from "../../types/user";
import { httpError, STATUS_CODE } from "../../utils/errors";
import { assertVehicleAccess } from "../vehicles/access.service";

const sessionNotFound = () =>
  httpError(
    STATUS_CODE.NOT_FOUND,
    "DIAGNOSTIC_SESSION_NOT_FOUND",
    "Essa leitura não existe.",
  );

const itemNotFound = () =>
  httpError(
    STATUS_CODE.NOT_FOUND,
    "CHECKLIST_ITEM_NOT_FOUND",
    "Essa pendência não existe.",
  );

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 60;

export interface SaveDiagnosticSessionPayload {
  startedAt: string;
  deviceName: string;
  adapterIdentity?: string | null;
  protocol?: string | null;
  voltage?: number | null;
  malfunctionLightOn?: boolean | null;
  storedCodes?: number | null;
  troubleCodes: {
    confirmed: DiagnosticTroubleCodes;
    pending: DiagnosticTroubleCodes;
    permanent: DiagnosticTroubleCodes;
  };
  monitors: DiagnosticMonitor[];
  supportedPids: string[];
  readings: DiagnosticReading[];
  trip?: DiagnosticTripSummary[];
  sampleCount?: number;
  tripStats?: DiagnosticTrip | null;
  findings: ChecklistFinding[];
}

export interface ChecklistItemView {
  code: string;
  title: string;
  why: string;
  priority: string;
  createdAt: Date;
  lastSeenAt: Date;
  doneAt: Date | null;
}

export interface ChecklistView {
  open: ChecklistItemView[];
  done: ChecklistItemView[];
}

export interface DiagnosticSessionView {
  id: string;
  startedAt: Date;
  deviceName: string;
  protocol: string | null;
  voltage: number | null;
  malfunctionLightOn: boolean | null;
  storedCodes: number | null;
  troubleCodes: DiagnosticSessionDocument["troubleCodes"];
  monitors: DiagnosticMonitor[];
  supportedPids: string[];
  readings: DiagnosticReading[];
  trip: DiagnosticTripSummary[];
  sampleCount: number;
  tripStats: DiagnosticTrip | null;
  createdAt: Date | null;
}

export interface ListSessionsQuery {
  limit?: number;
  before?: string;
}

const toItemView = (item: ChecklistItem): ChecklistItemView => ({
  code: item.code,
  title: item.title,
  why: item.why,
  priority: item.priority,
  createdAt: item.createdAt,
  lastSeenAt: item.lastSeenAt,
  doneAt: item.doneAt,
});

const toChecklistView = (items: ChecklistItem[]): ChecklistView => ({
  open: openItems(items).map(toItemView),
  done: doneItems(items).map(toItemView),
});

const toSessionView = (
  session: DiagnosticSessionDocument,
): DiagnosticSessionView => ({
  id: String(session._id),
  startedAt: session.startedAt,
  deviceName: session.deviceName,
  protocol: session.protocol ?? null,
  voltage: session.voltage ?? null,
  malfunctionLightOn: session.malfunctionLightOn ?? null,
  storedCodes: session.storedCodes ?? null,
  troubleCodes: session.troubleCodes,
  monitors: session.monitors ?? [],
  supportedPids: session.supportedPids ?? [],
  readings: session.readings ?? [],
  trip: session.trip ?? [],
  sampleCount: session.sampleCount ?? 0,
  tripStats: session.tripStats ?? null,
  createdAt: session.createdAt ?? null,
});

const loadChecklist = async (
  accountId: Types.ObjectId,
  vehicleId: Types.ObjectId,
): Promise<ChecklistItem[]> => {
  const stored = (await diagnosticChecklistRepository.findOne({
    accountId,
    vehicleId,
  })) as DiagnosticChecklistDocument | null;

  return stored?.items ?? [];
};

const persistChecklist = async (
  accountId: Types.ObjectId,
  vehicleId: Types.ObjectId,
  items: ChecklistItem[],
): Promise<void> => {
  await diagnosticChecklistRepository.updateOne(
    { accountId, vehicleId },
    { $set: { items, accountId, vehicleId } },
    { upsert: true },
  );
};

export const saveDiagnosticSession = async (
  requester: Requester,
  vehicleId: string,
  payload: SaveDiagnosticSessionPayload,
): Promise<{ session: DiagnosticSessionView; checklist: ChecklistView }> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");
  const startedAt = new Date(payload.startedAt);

  if (Number.isNaN(startedAt.getTime())) {
    throw httpError(
      STATUS_CODE.BAD_REQUEST,
      "DATA_INVALIDA",
      "A data da leitura não é válida.",
    );
  }

  const created = await diagnosticSessionRepository.insertOne({
    accountId: vehicle.accountId,
    vehicleId: vehicle._id,
    startedAt,
    deviceName: payload.deviceName,
    adapterIdentity: payload.adapterIdentity ?? null,
    protocol: payload.protocol ?? null,
    voltage: payload.voltage ?? null,
    malfunctionLightOn: payload.malfunctionLightOn ?? null,
    storedCodes: payload.storedCodes ?? null,
    troubleCodes: payload.troubleCodes,
    monitors: payload.monitors,
    supportedPids: payload.supportedPids,
    readings: payload.readings,
    trip: payload.trip ?? [],
    sampleCount: payload.sampleCount ?? 0,
    tripStats: payload.tripStats ?? null,
    createdBy: requester.userId,
  });

  const session = created.toObject() as DiagnosticSessionDocument;

  const merged = mergeFindings(
    await loadChecklist(vehicle.accountId, vehicle._id as Types.ObjectId),
    payload.findings,
    startedAt,
  );

  await persistChecklist(
    vehicle.accountId,
    vehicle._id as Types.ObjectId,
    merged,
  );

  return { session: toSessionView(session), checklist: toChecklistView(merged) };
};

export const listDiagnosticSessions = async (
  requester: Requester,
  vehicleId: string,
  query: ListSessionsQuery = {},
): Promise<{ sessions: DiagnosticSessionView[] }> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "read");
  const limit = Math.min(query.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const filter: Record<string, unknown> = { vehicleId: vehicle._id };

  if (query.before) filter.startedAt = { $lt: new Date(query.before) };

  const sessions = (await diagnosticSessionRepository.find(filter, null, {
    sort: { startedAt: -1 },
    limit,
  })) as DiagnosticSessionDocument[];

  return { sessions: sessions.map(toSessionView) };
};

export const readDiagnosticSession = async (
  requester: Requester,
  vehicleId: string,
  sessionId: string,
): Promise<DiagnosticSessionView> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "read");
  const session = (await diagnosticSessionRepository.findOne({
    _id: sessionId,
    vehicleId: vehicle._id,
  })) as DiagnosticSessionDocument | null;

  if (!session) throw sessionNotFound();

  return toSessionView(session);
};

export const readChecklist = async (
  requester: Requester,
  vehicleId: string,
): Promise<ChecklistView> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "read");
  return toChecklistView(
    await loadChecklist(vehicle.accountId, vehicle._id as Types.ObjectId),
  );
};

export const setChecklistItemDone = async (
  requester: Requester,
  vehicleId: string,
  code: string,
  done: boolean,
): Promise<ChecklistView> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");
  const items = await loadChecklist(
    vehicle.accountId,
    vehicle._id as Types.ObjectId,
  );

  if (!hasItem(items, code)) throw itemNotFound();

  const updated = setItemDone(items, code, done, new Date());
  await persistChecklist(
    vehicle.accountId,
    vehicle._id as Types.ObjectId,
    updated,
  );

  return toChecklistView(updated);
};

export const removeChecklistItem = async (
  requester: Requester,
  vehicleId: string,
  code: string,
): Promise<ChecklistView> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "manage");
  const items = await loadChecklist(
    vehicle.accountId,
    vehicle._id as Types.ObjectId,
  );

  if (!hasItem(items, code)) throw itemNotFound();

  const updated = removeItem(items, code);
  await persistChecklist(
    vehicle.accountId,
    vehicle._id as Types.ObjectId,
    updated,
  );

  return toChecklistView(updated);
};
