import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { lgpdConsentSchema } from "../../schemas/users/lgpdConsent.schema";
import { resolveRequester } from "../../services/users/requester.service";
import { acceptLgpdConsent } from "../../services/users/me.service";
import { sendSuccessResponse } from "../../utils/http";
import { STATUS_CODE } from "../../utils/errors";

export const execute = withErrorHandling(
  requireRole("owner", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const payload = validateBody(
        lgpdConsentSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await acceptLgpdConsent(requester, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
