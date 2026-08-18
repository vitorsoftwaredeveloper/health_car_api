import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { correctReadingSchema } from "../../schemas/odometer/correctReading.schema";
import { correctOdometerReading } from "../../services/odometer/odometer.service";
import { resolveRequester } from "../../services/users/requester.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const readingId = event.pathParameters?.readingId as string;
      const payload = validateBody(
        correctReadingSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await correctOdometerReading(requester, vehicleId, readingId, payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
