import { APIGatewayProxyResult } from "aws-lambda";
import { sendErrorResponse } from "../utils/http";

type Handler = (event: any) => Promise<APIGatewayProxyResult>;

export const withErrorHandling =
  (handler: Handler): Handler =>
  async (event: any): Promise<APIGatewayProxyResult> => {
    try {
      return await handler(event);
    } catch (error: any) {
      console.error("handler error", {
        message: error?.message,
        statusCode: error?.statusCode,
        code: error?.code,
      });
      return sendErrorResponse(error);
    }
  };
