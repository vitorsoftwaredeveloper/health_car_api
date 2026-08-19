import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { createCustomItemSchema } from "../../schemas/plan/createCustomItem.schema";
import { createCustomPlanItem } from "../../services/plan/planItem.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const payload = validateBody(
        createCustomItemSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await createCustomPlanItem(requester, vehicleId, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
