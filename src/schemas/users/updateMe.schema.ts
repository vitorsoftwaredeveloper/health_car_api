import { JSONSchemaType } from "ajv";
import { UpdateMePayload } from "../../services/users/me.service";

export const updateMeSchema: JSONSchemaType<UpdateMePayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 2, maxLength: 120, nullable: true },
    phone: {
      type: "string",
      pattern: "^\\+?[0-9 ()-]{8,20}$",
      nullable: true,
    },
    theme: { type: "string", enum: ["light", "dark", "system"], nullable: true },
  },
  required: [],
};
