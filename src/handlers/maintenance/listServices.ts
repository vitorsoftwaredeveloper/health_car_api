import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { listMaintenanceEvents } from "../../services/maintenance/history.service";
import { resolveRequester } from "../../services/users/requester.service";
import { MaintenanceType } from "../../types/maintenance";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const query = event.queryStringParameters ?? {};

      return sendSuccessResponse(
        await listMaintenanceEvents(requester, vehicleId, {
          type: query.type as MaintenanceType | undefined,
          year: Number(query.year) || undefined,
          limit: Number(query.limit) || undefined,
          before: query.before,
        }),
      );
    },
  ),
);
