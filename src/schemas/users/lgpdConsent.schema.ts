import { JSONSchemaType } from "ajv";
import { LgpdConsentPayload } from "../../services/users/me.service";

export const lgpdConsentSchema: JSONSchemaType<LgpdConsentPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    termsVersion: { type: "string", minLength: 1, maxLength: 20 },
  },
  required: ["termsVersion"],
};
