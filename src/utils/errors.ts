export const STATUS_CODE = {
  SUCCESS: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

export const DUPLICATE_KEY_ERROR_CODE = 11000;

export interface HttpErrorShape {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export class HttpError extends Error implements HttpErrorShape {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const httpError = (
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): HttpError => new HttpError(statusCode, code, message, details);
