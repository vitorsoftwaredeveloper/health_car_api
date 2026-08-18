import { JSONSchemaType } from "ajv";
import { SnoozeAlertPayload } from "../../services/alerts/alertInbox.service";

export const snoozeAlertSchema: JSONSchemaType<SnoozeAlertPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    days: { type: "integer", minimum: 1, maximum: 365, nullable: true },
    km: { type: "integer", minimum: 100, maximum: 50000, nullable: true },
  },
  required: [],
};
