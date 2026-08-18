import { JSONSchemaType } from "ajv";
import { CreateOdometerReadingPayload } from "../../services/odometer/odometer.service";

export const createReadingSchema: JSONSchemaType<CreateOdometerReadingPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    km: { type: "integer", minimum: 0, maximum: 3000000 },
    date: { type: "string", format: "date", nullable: true },
    source: { type: "string", enum: ["manual", "refuel"], nullable: true },
  },
  required: ["km"],
};
