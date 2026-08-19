import { JSONSchemaType } from "ajv";
import { UpdatePlanItemPayload } from "../../services/plan/planItem.service";

export const updatePlanItemSchema: JSONSchemaType<UpdatePlanItemPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    intervalKm: { type: "integer", minimum: 100, maximum: 500000, nullable: true },
    intervalMonths: { type: "integer", minimum: 1, maximum: 240, nullable: true },
    lastServiceKm: { type: "integer", minimum: 0, maximum: 3000000, nullable: true },
    lastServiceDate: { type: "string", format: "date", nullable: true },
    leadTimeDays: { type: "integer", minimum: 1, maximum: 180, nullable: true },
    leadTimeKm: { type: "integer", minimum: 100, maximum: 20000, nullable: true },
    note: { type: "string", maxLength: 300, nullable: true },
    active: { type: "boolean", nullable: true },
  },
  required: [],
};
