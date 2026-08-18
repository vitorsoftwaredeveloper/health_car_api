import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { catalogItemSchema } from "../../schemas/catalog/catalogItem.schema";
import { updateCatalogItem } from "../../services/catalog/catalog.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("admin")(
    async (event): Promise<APIGatewayProxyResult> => {
      const catalogItemId = event.pathParameters?.catalogItemId as string;
      const payload = validateBody(
        catalogItemSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await updateCatalogItem(catalogItemId, payload),
      );
    },
  ),
);
