import { Types } from "mongoose";
import { createDownloadUrl } from "../../libs/s3";
import { attachmentRepository } from "../../repositories/attachment.repository";
import { maintenanceEventRepository } from "../../repositories/maintenanceEvent.repository";
import { AttachmentDocument, MaintenanceEventDocument, MaintenanceType } from "../../types/maintenance";
import { Requester } from "../../types/user";
import { httpError, STATUS_CODE } from "../../utils/errors";
import { assertVehicleAccess } from "../vehicles/access.service";
import {
  MaintenanceEventView,
  toMaintenanceEventView,
} from "./maintenance.service";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface ListMaintenanceQuery {
  type?: MaintenanceType;
  year?: number;
  limit?: number;
  before?: string;
}

export interface MaintenanceTimeline {
  events: MaintenanceEventView[];
  nextCursor: string | null;
  totalCentsInPage: number;
}

export interface MaintenanceEventDetail extends MaintenanceEventView {
  attachmentUrls: { attachmentId: string; fileName: string; url: string }[];
}

const eventNotFound = () =>
  httpError(
    STATUS_CODE.NOT_FOUND,
    "MAINTENANCE_EVENT_NOT_FOUND",
    "Serviço não encontrado.",
  );

export const listMaintenanceEvents = async (
  requester: Requester,
  vehicleId: string,
  query: ListMaintenanceQuery,
): Promise<MaintenanceTimeline> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "read");

  const limit = Math.min(query.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const filter: Record<string, unknown> = { vehicleId: vehicle._id };

  if (query.type) filter.type = query.type;

  if (query.year) {
    filter.date = {
      $gte: new Date(Date.UTC(query.year, 0, 1)),
      $lt: new Date(Date.UTC(query.year + 1, 0, 1)),
    };
  }

  if (query.before) {
    filter.date = { ...(filter.date as object), $lt: new Date(query.before) };
  }

  const events = (await maintenanceEventRepository.find(filter, null, {
    sort: { date: -1, createdAt: -1 },
    limit: limit + 1,
  })) as MaintenanceEventDocument[];

  const page = events.slice(0, limit);
  const last = page[page.length - 1];

  return {
    events: page.map(toMaintenanceEventView),
    nextCursor:
      events.length > limit && last ? last.date.toISOString() : null,
    totalCentsInPage: page.reduce((total, event) => total + event.totalCents, 0),
  };
};

export const getMaintenanceEvent = async (
  requester: Requester,
  vehicleId: string,
  eventId: string,
): Promise<MaintenanceEventDetail> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "read");

  if (!Types.ObjectId.isValid(eventId)) throw eventNotFound();

  const event = (await maintenanceEventRepository.findOne({
    _id: new Types.ObjectId(eventId),
    vehicleId: vehicle._id,
  })) as MaintenanceEventDocument | null;

  if (!event) throw eventNotFound();

  const attachments = (await attachmentRepository.find({
    "link.documentId": event._id,
  })) as AttachmentDocument[];

  const attachmentUrls = await Promise.all(
    attachments.map(async (attachment) => ({
      attachmentId: String(attachment._id),
      fileName: attachment.fileName,
      url: await createDownloadUrl(attachment.s3Key),
    })),
  );

  return { ...toMaintenanceEventView(event), attachmentUrls };
};
