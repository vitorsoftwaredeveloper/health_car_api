import { JSONSchemaType } from "ajv";
import { CreateFuelEntryPayload } from "../../services/fuel/fuel.service";

export const createFuelEntrySchema: JSONSchemaType<CreateFuelEntryPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string", format: "date", nullable: true },
    odometerKm: { type: "integer", minimum: 0, maximum: 3000000 },
    liters: { type: "number", exclusiveMinimum: 0, maximum: 2000 },
    fuelKind: { type: "string", enum: ["gasoline", "ethanol", "diesel", "cng"] },
    totalCents: { type: "integer", minimum: 0, maximum: 100000000, nullable: true },
    fullTank: { type: "boolean", nullable: true },
  },
  required: ["odometerKm", "liters", "fuelKind"],
};
