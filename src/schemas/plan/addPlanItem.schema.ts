import { JSONSchemaType } from "ajv";
import { AddPlanItemPayload } from "../../services/plan/plan.service";

export const addPlanItemSchema: JSONSchemaType<AddPlanItemPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    catalogItemCode: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_]{2,39}$" },
    intervalKm: { type: "integer", minimum: 100, maximum: 500000, nullable: true },
    intervalMonths: { type: "integer", minimum: 1, maximum: 240, nullable: true },
    lastServiceKm: { type: "integer", minimum: 0, maximum: 3000000, nullable: true },
    lastServiceDate: { type: "string", format: "date", nullable: true },
    active: { type: "boolean", nullable: true },
  },
  required: ["catalogItemCode"],
};
