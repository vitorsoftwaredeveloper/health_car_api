import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { resolveRequester } from "../../services/users/requester.service";
import { deleteVehicle } from "../../services/vehicles/vehicle.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      await deleteVehicle(requester, vehicleId);
      return sendSuccessResponse(undefined, STATUS_CODE.NO_CONTENT);
    },
  ),
);
