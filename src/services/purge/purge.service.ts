import { deleteObject } from "../../libs/s3";
import { attachmentRepository } from "../../repositories/attachment.repository";
import { maintenanceEventRepository } from "../../repositories/maintenanceEvent.repository";
import { AttachmentDocument } from "../../types/maintenance";

const PAGE_SIZE = 100;

export interface PurgeJobResult {
  eventsPurged: number;
  attachmentsPurged: number;
  objectsRemoved: number;
  objectFailures: number;
}

export const runPurgeExpired = async (
  reference: Date = new Date(),
): Promise<PurgeJobResult> => {
  const result: PurgeJobResult = {
    eventsPurged: 0,
    attachmentsPurged: 0,
    objectsRemoved: 0,
    objectFailures: 0,
  };

  const due = { purgeAfter: { $ne: null, $lte: reference } };

  const attachments = (await attachmentRepository.find(due, null, {
    limit: PAGE_SIZE,
  })) as AttachmentDocument[];

  const removable = [];

  for (const attachment of attachments) {
    try {
      await deleteObject(attachment.s3Key);
      result.objectsRemoved += 1;
      removable.push(attachment._id);
    } catch (error: any) {
      result.objectFailures += 1;
      console.error("attachment object removal failed", {
        attachmentId: String(attachment._id),
        message: error?.message,
      });
    }
  }

  if (removable.length) {
    const removed = await attachmentRepository.deleteMany({
      _id: { $in: removable },
    });
    result.attachmentsPurged = removed.deletedCount ?? 0;
  }

  const events = await maintenanceEventRepository.deleteMany(due);
  result.eventsPurged = events.deletedCount ?? 0;

  return result;
};
