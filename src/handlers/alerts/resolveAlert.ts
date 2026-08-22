import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { resolveAlertSchema } from "../../schemas/alerts/resolveAlert.schema";
import { resolveAlert } from "../../services/alerts/resolveAlert.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const alertId = event.pathParameters?.alertId as string;
      const payload = validateBody(
        resolveAlertSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await resolveAlert(requester, alertId, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
