import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { createAttachmentSchema } from "../../schemas/maintenance/createAttachment.schema";
import { createAttachmentUpload } from "../../services/maintenance/attachment.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "driver")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const payload = validateBody(
        createAttachmentSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await createAttachmentUpload(requester, vehicleId, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
