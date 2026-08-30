import { JSONSchemaType } from "ajv";

export interface UpdateChecklistItemPayload {
  done: boolean;
}

export const updateChecklistItemSchema: JSONSchemaType<UpdateChecklistItemPayload> =
  {
    type: "object",
    additionalProperties: false,
    properties: {
      done: { type: "boolean" },
    },
    required: ["done"],
  };
