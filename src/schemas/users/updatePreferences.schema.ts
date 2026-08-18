import { JSONSchemaType } from "ajv";
import { PreferencesPatch } from "../../domain/preferences";

const TIME_PATTERN = "^([01][0-9]|2[0-3]):[0-5][0-9]$";

export const updatePreferencesSchema: JSONSchemaType<PreferencesPatch> = {
  type: "object",
  additionalProperties: false,
  properties: {
    pushEnabled: { type: "boolean", nullable: true },
    milestones: {
      type: "object",
      additionalProperties: false,
      nullable: true,
      properties: {
        D30: { type: "boolean", nullable: true },
        D7: { type: "boolean", nullable: true },
        D0: { type: "boolean", nullable: true },
        OVERDUE_WEEKLY: { type: "boolean", nullable: true },
      },
      required: [],
    },
    quietHours: {
      type: "object",
      additionalProperties: false,
      nullable: true,
      properties: {
        start: { type: "string", pattern: TIME_PATTERN },
        end: { type: "string", pattern: TIME_PATTERN },
      },
      required: ["start", "end"],
    },
    timezone: { type: "string", minLength: 3, maxLength: 64, nullable: true },
    theme: { type: "string", enum: ["light", "dark", "system"], nullable: true },
  },
  required: [],
};
