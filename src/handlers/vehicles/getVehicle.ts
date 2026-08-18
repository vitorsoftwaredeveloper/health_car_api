import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { resolveRequester } from "../../services/users/requester.service";
import { getVehicle } from "../../services/vehicles/vehicle.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "driver", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      return sendSuccessResponse(await getVehicle(requester, vehicleId));
    },
  ),
);
