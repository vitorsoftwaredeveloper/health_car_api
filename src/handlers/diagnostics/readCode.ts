import { APIGatewayProxyResult } from "aws-lambda";
import { withErrorHandling } from "../../middlewares/errorHandler";
import { requireRole } from "../../middlewares/roleGuard";
import {
  readDiagnosticCode,
  readDiagnosticCodes,
} from "../../services/diagnostics/diagnosticCode.service";
import { sendSuccessResponse } from "../../utils/http";

export const execute = withErrorHandling(
  requireRole("owner", "admin")(
    async (event): Promise<APIGatewayProxyResult> => {
      const code = event.pathParameters?.code;

      if (code) return sendSuccessResponse(await readDiagnosticCode(code));

      const codes = (event.queryStringParameters?.codes ?? "")
        .split(",")
        .map((item: string) => item.trim())
        .filter(Boolean);

      return sendSuccessResponse({ codes: await readDiagnosticCodes(codes) });
    },
  ),
);
