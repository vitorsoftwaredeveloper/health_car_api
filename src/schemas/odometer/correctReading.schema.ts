import { JSONSchemaType } from "ajv";
import { CorrectOdometerReadingPayload } from "../../services/odometer/odometer.service";

export const correctReadingSchema: JSONSchemaType<CorrectOdometerReadingPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    km: { type: "integer", minimum: 0, maximum: 3000000 },
    date: { type: "string", format: "date", nullable: true },
  },
  required: ["km"],
};
