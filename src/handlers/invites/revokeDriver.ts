import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { revokeDriver } from "../../services/invites/invite.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const driverId = event.pathParameters?.driverId as string;
      await revokeDriver(requester, driverId);
      return sendSuccessResponse(undefined, STATUS_CODE.NO_CONTENT);
    },
  ),
);
