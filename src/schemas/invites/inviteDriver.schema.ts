import { JSONSchemaType } from "ajv";
import { InviteDriverPayload } from "../../services/invites/invite.service";

export const inviteDriverSchema: JSONSchemaType<InviteDriverPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    email: { type: "string", format: "email", maxLength: 120 },
    name: { type: "string", minLength: 2, maxLength: 120, nullable: true },
    vehicleIds: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
    },
  },
  required: ["email", "vehicleIds"],
};
