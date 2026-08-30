import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { removeChecklistItem } from "../../services/diagnostics/diagnostics.service";
import { resolveRequester } from "../../services/users/requester.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(async (event, auth): Promise<APIGatewayProxyResult> => {
    const requester = await resolveRequester(auth);
    const vehicleId = event.pathParameters?.vehicleId as string;
    const code = event.pathParameters?.code as string;

    return sendSuccessResponse(
      await removeChecklistItem(requester, vehicleId, code),
    );
  }),
);
