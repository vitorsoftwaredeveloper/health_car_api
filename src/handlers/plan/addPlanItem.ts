import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { addPlanItemSchema } from "../../schemas/plan/addPlanItem.schema";
import { addCatalogItemToPlan } from "../../services/plan/plan.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const payload = validateBody(
        addPlanItemSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await addCatalogItemToPlan(requester, vehicleId, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
