import { JSONSchemaType } from "ajv";
import { ResolveAlertPayload } from "../../services/alerts/resolveAlert.service";

export const resolveAlertSchema: JSONSchemaType<ResolveAlertPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    km: { type: "integer", minimum: 0, maximum: 3000000 },
    date: { type: "string", format: "date", nullable: true },
  },
  required: ["km"],
};
