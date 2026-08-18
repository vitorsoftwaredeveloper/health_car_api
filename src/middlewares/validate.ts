import Ajv, { JSONSchemaType } from "ajv";
import addFormats from "ajv-formats";
import { httpError, STATUS_CODE } from "../utils/errors";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export const parseRequestBody = (body: string | null | undefined): any => {
  if (!body) {
    throw httpError(
      STATUS_CODE.BAD_REQUEST,
      "BAD_REQUEST",
      "Corpo da requisição vazio.",
    );
  }

  try {
    return JSON.parse(body);
  } catch {
    throw httpError(STATUS_CODE.BAD_REQUEST, "BAD_REQUEST", "JSON inválido.");
  }
};

export const validateBody = <T>(
  schema: JSONSchemaType<T>,
  data: unknown,
): T => {
  const validateFn = ajv.compile<T>(schema);
  const valid = validateFn(data);

  if (!valid) {
    throw httpError(
      STATUS_CODE.BAD_REQUEST,
      "VALIDATION_ERROR",
      "Erro de validação.",
      validateFn.errors,
    );
  }

  return data as T;
};
