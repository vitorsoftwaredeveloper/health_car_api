import { APIGatewayProxyResult } from "aws-lambda";
import { AuthClaims, Role } from "../types/auth";
import { requireAuthClaims } from "./auth";
import { httpError, STATUS_CODE } from "../utils/errors";

type AuthorizedHandler = (
  event: any,
  auth: AuthClaims,
) => Promise<APIGatewayProxyResult>;

export const requireRole =
  (...roles: Role[]) =>
  (handler: AuthorizedHandler) =>
  async (event: any): Promise<APIGatewayProxyResult> => {
    const auth = requireAuthClaims(event);

    if (!roles.includes(auth.role)) {
      throw httpError(
        STATUS_CODE.FORBIDDEN,
        "FORBIDDEN",
        "Papel sem permissão para este recurso.",
      );
    }

    return handler(event, auth);
  };
