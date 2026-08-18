import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_TTL_SECONDS = 300;
const DOWNLOAD_URL_TTL_SECONDS = 300;

let s3Client: S3Client | null = null;

const createS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({ region: process.env.REGION });
  }
  return s3Client;
};

const bucket = (): string => process.env.ATTACHMENTS_BUCKET as string;

export const buildAttachmentKey = (
  accountId: string,
  vehicleId: string,
  attachmentId: string,
  extension: string,
): string => `accounts/${accountId}/vehicles/${vehicleId}/${attachmentId}.${extension}`;

export const createUploadUrl = async (
  key: string,
  contentType: string,
): Promise<string> =>
  getSignedUrl(
    createS3Client(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

export const createDownloadUrl = async (key: string): Promise<string> =>
  getSignedUrl(
    createS3Client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );

export const deleteObject = async (key: string): Promise<void> => {
  await createS3Client().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
  );
};
