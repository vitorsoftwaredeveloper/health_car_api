import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { updateMeSchema } from "../../schemas/users/updateMe.schema";
import { resolveRequester } from "../../services/users/requester.service";
import { updateMe } from "../../services/users/me.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const payload = validateBody(
        updateMeSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(await updateMe(requester, payload));
    },
  ),
);
