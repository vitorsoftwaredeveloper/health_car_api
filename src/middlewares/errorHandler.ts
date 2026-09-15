import { APIGatewayProxyResult } from "aws-lambda";
import {
  bindLogContext,
  clearLogContext,
  describeError,
  log,
} from "../libs/logger";
import { sendErrorResponse } from "../utils/http";
import { STATUS_CODE } from "../utils/errors";

type Handler = (event: any) => Promise<APIGatewayProxyResult>;

const requestFields = (event: any): Record<string, unknown> => ({
  requestId: event?.requestContext?.requestId,
  route: event?.routeKey ?? event?.requestContext?.routeKey,
  method: event?.requestContext?.http?.method,
  path: event?.rawPath,
  sub: event?.requestContext?.authorizer?.jwt?.claims?.sub,
});

const isServerFailure = (statusCode: number): boolean =>
  statusCode >= STATUS_CODE.INTERNAL_SERVER_ERROR;

export const withErrorHandling =
  (handler: Handler): Handler =>
  async (event: any): Promise<APIGatewayProxyResult> => {
    const startedAt = Date.now();
    clearLogContext();
    bindLogContext(requestFields(event));

    try {
      const response = await handler(event);
      log.info("request.completed", {
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error: any) {
      const response = sendErrorResponse(error);
      const failure = describeError(error);
      const level = isServerFailure(response.statusCode) ? "error" : "warn";

      log[level]("request.failed", {
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        ...failure,
        stack: isServerFailure(response.statusCode) ? failure.stack : undefined,
      });

      return response;
    } finally {
      clearLogContext();
    }
  };
