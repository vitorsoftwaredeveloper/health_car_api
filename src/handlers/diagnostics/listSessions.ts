import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { listDiagnosticSessions } from "../../services/diagnostics/diagnostics.service";
import { resolveRequester } from "../../services/users/requester.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const limit = Number(event.queryStringParameters?.limit) || undefined;
      const before = event.queryStringParameters?.before;

      return sendSuccessResponse(
        await listDiagnosticSessions(requester, vehicleId, { limit, before }),
      );
    },
  ),
);
