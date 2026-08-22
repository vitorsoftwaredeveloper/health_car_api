import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { registerDeviceSchema } from "../../schemas/devices/registerDevice.schema";
import { registerDevice } from "../../services/notifications/device.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const payload = validateBody(
        registerDeviceSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await registerDevice(requester, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
