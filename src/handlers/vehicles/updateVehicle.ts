import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { updateVehicleSchema } from "../../schemas/vehicles/updateVehicle.schema";
import { resolveRequester } from "../../services/users/requester.service";
import { updateVehicle } from "../../services/vehicles/vehicle.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const payload = validateBody(
        updateVehicleSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await updateVehicle(requester, vehicleId, payload),
      );
    },
  ),
);
