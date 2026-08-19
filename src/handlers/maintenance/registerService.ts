import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { registerMaintenanceSchema } from "../../schemas/maintenance/registerMaintenance.schema";
import { registerMaintenanceEvent } from "../../services/maintenance/maintenance.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "driver")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const payload = validateBody(
        registerMaintenanceSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await registerMaintenanceEvent(requester, vehicleId, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
