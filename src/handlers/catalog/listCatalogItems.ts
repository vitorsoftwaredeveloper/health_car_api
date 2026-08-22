import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { listCatalogItems } from "../../services/catalog/catalog.service";
import { Category, CATEGORIES } from "../../types/catalog";
import { httpError, STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "admin")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const category = event.queryStringParameters?.category as
        | Category
        | undefined;

      if (category && !CATEGORIES.includes(category)) {
        throw httpError(
          STATUS_CODE.BAD_REQUEST,
          "INVALID_CATEGORY",
          "Categoria desconhecida.",
        );
      }

      const includeInactive =
        auth.role === "admin" &&
        event.queryStringParameters?.includeInactive === "true";

      return sendSuccessResponse(
        await listCatalogItems({ category, includeInactive }),
      );
    },
  ),
);
