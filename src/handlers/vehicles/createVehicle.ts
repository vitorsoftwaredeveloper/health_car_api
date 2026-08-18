import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { createVehicleSchema } from "../../schemas/vehicles/createVehicle.schema";
import { resolveRequester } from "../../services/users/requester.service";
import { createVehicle } from "../../services/vehicles/vehicle.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const payload = validateBody(
        createVehicleSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await createVehicle(requester, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
