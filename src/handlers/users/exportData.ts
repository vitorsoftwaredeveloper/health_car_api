import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { exportAccountData } from "../../services/users/lgpd.service";
import { resolveRequester } from "../../services/users/requester.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "admin")(
    async (_event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      return sendSuccessResponse(await exportAccountData(requester));
    },
  ),
);
