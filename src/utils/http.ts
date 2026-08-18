import { APIGatewayProxyResult } from "aws-lambda";
import { STATUS_CODE } from "./errors";

const CODE_BY_STATUS: Record<number, string> = {
  [STATUS_CODE.BAD_REQUEST]: "BAD_REQUEST",
  [STATUS_CODE.UNAUTHORIZED]: "UNAUTHORIZED",
  [STATUS_CODE.FORBIDDEN]: "FORBIDDEN",
  [STATUS_CODE.NOT_FOUND]: "NOT_FOUND",
  [STATUS_CODE.CONFLICT]: "CONFLICT",
  [STATUS_CODE.UNPROCESSABLE_ENTITY]: "UNPROCESSABLE_ENTITY",
  [STATUS_CODE.INTERNAL_SERVER_ERROR]: "INTERNAL_SERVER_ERROR",
};

export const sendErrorResponse = (error: any): APIGatewayProxyResult => {
  const statusCode = error.statusCode || STATUS_CODE.INTERNAL_SERVER_ERROR;

  return {
    statusCode,
    body: JSON.stringify({
      error: {
        code: error.code || CODE_BY_STATUS[statusCode] || "INTERNAL_SERVER_ERROR",
        message: error.message || "Internal Server Error",
        ...(error.details && { details: error.details }),
      },
    }),
  };
};

export const sendSuccessResponse = (
  data?: unknown,
  statusCode: number = STATUS_CODE.SUCCESS,
): APIGatewayProxyResult => ({
  statusCode,
  body: statusCode === STATUS_CODE.NO_CONTENT
    ? ""
    : JSON.stringify(data === undefined ? {} : { data }),
});
