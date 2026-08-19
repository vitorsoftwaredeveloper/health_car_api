import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { removeDevice } from "../../services/notifications/device.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "driver", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const deviceId = event.pathParameters?.deviceId as string;
      await removeDevice(requester, deviceId);
      return sendSuccessResponse(undefined, STATUS_CODE.NO_CONTENT);
    },
  ),
);
