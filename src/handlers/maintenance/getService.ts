import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { getMaintenanceEvent } from "../../services/maintenance/history.service";
import { resolveRequester } from "../../services/users/requester.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const eventId = event.pathParameters?.eventId as string;

      return sendSuccessResponse(
        await getMaintenanceEvent(requester, vehicleId, eventId),
      );
    },
  ),
);
