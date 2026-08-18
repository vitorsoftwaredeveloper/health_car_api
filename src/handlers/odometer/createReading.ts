import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { createReadingSchema } from "../../schemas/odometer/createReading.schema";
import { createOdometerReading } from "../../services/odometer/odometer.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "driver")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const payload = validateBody(
        createReadingSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await createOdometerReading(requester, vehicleId, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
