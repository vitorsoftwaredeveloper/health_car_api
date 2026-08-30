import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { updateChecklistItemSchema } from "../../schemas/diagnostics/updateChecklistItem.schema";
import { setChecklistItemDone } from "../../services/diagnostics/diagnostics.service";
import { resolveRequester } from "../../services/users/requester.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(async (event, auth): Promise<APIGatewayProxyResult> => {
    const requester = await resolveRequester(auth);
    const vehicleId = event.pathParameters?.vehicleId as string;
    const code = event.pathParameters?.code as string;
    const payload = validateBody(
      updateChecklistItemSchema,
      parseRequestBody(event.body),
    );

    return sendSuccessResponse(
      await setChecklistItemDone(requester, vehicleId, code, payload.done),
    );
  }),
);
