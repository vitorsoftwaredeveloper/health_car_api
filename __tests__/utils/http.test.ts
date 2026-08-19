import { SECURITY_HEADERS, sendErrorResponse, sendSuccessResponse } from "../../src/utils/http";
import { httpError, STATUS_CODE } from "../../src/utils/errors";

describe("sendSuccessResponse", () => {
  it("responde com JSON e cabeçalhos de segurança", () => {
    const response = sendSuccessResponse({ id: "1" });

    expect(response.statusCode).toBe(200);
    expect(response.headers).toEqual(SECURITY_HEADERS);
    expect(response.headers?.["Content-Type"]).toBe("application/json; charset=utf-8");
    expect(response.headers?.["X-Content-Type-Options"]).toBe("nosniff");
    expect(JSON.parse(response.body)).toEqual({ data: { id: "1" } });
  });

  it("não manda corpo no 204", () => {
    const response = sendSuccessResponse(undefined, STATUS_CODE.NO_CONTENT);

    expect(response.body).toBe("");
    expect(response.headers?.["Cache-Control"]).toBe("no-store");
  });
});

describe("sendErrorResponse", () => {
  it("mantém os cabeçalhos no erro", () => {
    const response = sendErrorResponse(
      httpError(STATUS_CODE.NOT_FOUND, "VEHICLE_NOT_FOUND", "Veículo não encontrado."),
    );

    expect(response.statusCode).toBe(404);
    expect(response.headers?.["X-Content-Type-Options"]).toBe("nosniff");
    expect(JSON.parse(response.body).error.code).toBe("VEHICLE_NOT_FOUND");
  });

  it("cai para erro interno sem status", () => {
    const response = sendErrorResponse(new Error("boom"));

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
