import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { inviteDriverSchema } from "../../schemas/invites/inviteDriver.schema";
import { inviteDriver } from "../../services/invites/invite.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const payload = validateBody(
        inviteDriverSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await inviteDriver(requester, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
