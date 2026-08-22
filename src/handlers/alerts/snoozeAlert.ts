import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { snoozeAlertSchema } from "../../schemas/alerts/snoozeAlert.schema";
import { snoozeAlert } from "../../services/alerts/alertInbox.service";
import { resolveRequester } from "../../services/users/requester.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const alertId = event.pathParameters?.alertId as string;
      const payload = validateBody(
        snoozeAlertSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await snoozeAlert(requester, alertId, payload),
      );
    },
  ),
);
