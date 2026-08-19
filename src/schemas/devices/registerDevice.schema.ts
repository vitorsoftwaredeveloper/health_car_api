import { JSONSchemaType } from "ajv";
import { RegisterDevicePayload } from "../../services/notifications/device.service";

export const registerDeviceSchema: JSONSchemaType<RegisterDevicePayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    endpoint: { type: "string", minLength: 10, maxLength: 1000, format: "uri" },
    keys: {
      type: "object",
      additionalProperties: false,
      properties: {
        p256dh: { type: "string", minLength: 10, maxLength: 200 },
        auth: { type: "string", minLength: 10, maxLength: 100 },
      },
      required: ["p256dh", "auth"],
    },
    userAgent: { type: "string", maxLength: 300, nullable: true },
    standalone: { type: "boolean", nullable: true },
  },
  required: ["endpoint", "keys"],
};
