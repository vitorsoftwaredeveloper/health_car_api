import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { listAlerts } from "../../services/alerts/alertInbox.service";
import { resolveRequester } from "../../services/users/requester.service";
import { AlertStatus } from "../../types/alert";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "driver", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const query = event.queryStringParameters ?? {};

      return sendSuccessResponse(
        await listAlerts(requester, {
          status: query.status as AlertStatus | undefined,
          vehicleId: query.vehicleId,
          limit: Number(query.limit) || undefined,
          before: query.before,
        }),
      );
    },
  ),
);
