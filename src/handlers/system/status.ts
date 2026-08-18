import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  async (): Promise<APIGatewayProxyResult> =>
    sendSuccessResponse({
      service: process.env.SERVICE,
      stage: process.env.STAGE,
      time: new Date().toISOString(),
    }),
);
