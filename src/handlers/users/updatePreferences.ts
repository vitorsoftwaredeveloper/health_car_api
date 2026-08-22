import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { updatePreferencesSchema } from "../../schemas/users/updatePreferences.schema";
import { resolveRequester } from "../../services/users/requester.service";
import { updatePreferences } from "../../services/users/me.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const payload = validateBody(
        updatePreferencesSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(await updatePreferences(requester, payload));
    },
  ),
);
