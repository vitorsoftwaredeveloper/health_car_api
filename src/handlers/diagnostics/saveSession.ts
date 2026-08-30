import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { saveSessionSchema } from "../../schemas/diagnostics/saveSession.schema";
import { saveDiagnosticSession } from "../../services/diagnostics/diagnostics.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(async (event, auth): Promise<APIGatewayProxyResult> => {
    const requester = await resolveRequester(auth);
    const vehicleId = event.pathParameters?.vehicleId as string;
    const payload = validateBody(
      saveSessionSchema,
      parseRequestBody(event.body),
    );

    return sendSuccessResponse(
      await saveDiagnosticSession(requester, vehicleId, payload),
      STATUS_CODE.CREATED,
    );
  }),
);
