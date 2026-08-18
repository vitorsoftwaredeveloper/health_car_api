import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import { parseRequestBody, validateBody } from "../../middlewares/validate";
import { catalogItemSchema } from "../../schemas/catalog/catalogItem.schema";
import { createCatalogItem } from "../../services/catalog/catalog.service";
import { STATUS_CODE } from "../../utils/errors";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("admin")(
    async (event): Promise<APIGatewayProxyResult> => {
      const payload = validateBody(
        catalogItemSchema,
        parseRequestBody(event.body),
      );
      return sendSuccessResponse(
        await createCatalogItem(payload),
        STATUS_CODE.CREATED,
      );
    },
  ),
);
