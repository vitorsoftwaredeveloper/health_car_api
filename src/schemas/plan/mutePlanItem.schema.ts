import { JSONSchemaType } from "ajv";
import { MutePlanItemPayload } from "../../services/plan/planItem.service";

export const mutePlanItemSchema: JSONSchemaType<MutePlanItemPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    muted: { type: "boolean" },
  },
  required: ["muted"],
};
