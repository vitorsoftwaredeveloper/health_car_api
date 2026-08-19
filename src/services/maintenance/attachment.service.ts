import { Types } from "mongoose";
import { buildAttachmentKey, createUploadUrl } from "../../libs/s3";
import { attachmentRepository } from "../../repositories/attachment.repository";
import { AttachmentDocument, AttachmentType } from "../../types/maintenance";
import { Requester } from "../../types/user";
import { httpError, STATUS_CODE } from "../../utils/errors";
import { assertVehicleAccess } from "../vehicles/access.service";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export interface CreateAttachmentPayload {
  fileName: string;
  mimeType: string;
  sizeBytes?: number | null;
  type?: AttachmentType;
}

export interface AttachmentUploadView {
  attachmentId: string;
  uploadUrl: string;
  s3Key: string;
  expiresInSeconds: number;
}

export const createAttachmentUpload = async (
  requester: Requester,
  vehicleId: string,
  payload: CreateAttachmentPayload,
): Promise<AttachmentUploadView> => {
  const vehicle = await assertVehicleAccess(requester, vehicleId, "write");

  const extension = EXTENSION_BY_MIME[payload.mimeType];
  if (!extension) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "UNSUPPORTED_FILE_TYPE",
      "Envie a nota em JPG, PNG, HEIC ou PDF.",
    );
  }

  if (payload.sizeBytes && payload.sizeBytes > MAX_SIZE_BYTES) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "FILE_TOO_LARGE",
      "O arquivo passa de 10 MB.",
    );
  }

  const attachmentId = new Types.ObjectId();
  const s3Key = buildAttachmentKey(
    String(vehicle.accountId),
    String(vehicle._id),
    String(attachmentId),
    extension,
  );

  await attachmentRepository.insertOne({
    _id: attachmentId,
    accountId: vehicle.accountId,
    vehicleId: vehicle._id,
    s3Key,
    fileName: payload.fileName.trim(),
    mimeType: payload.mimeType,
    sizeBytes: payload.sizeBytes ?? null,
    type: payload.type ?? "receipt",
    link: null,
    uploadedBy: requester.userId,
  } as AttachmentDocument);

  return {
    attachmentId: String(attachmentId),
    uploadUrl: await createUploadUrl(s3Key, payload.mimeType),
    s3Key,
    expiresInSeconds: 300,
  };
};
