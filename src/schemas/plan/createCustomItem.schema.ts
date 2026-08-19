import { JSONSchemaType } from "ajv";
import { CreateCustomItemPayload } from "../../services/plan/planItem.service";
import { CATEGORIES } from "../../types/catalog";

export const createCustomItemSchema: JSONSchemaType<CreateCustomItemPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 2, maxLength: 80 },
    category: { type: "string", enum: CATEGORIES },
    dueType: { type: "string", enum: ["km", "time", "both", "inspection"] },
    intervalKm: { type: "integer", minimum: 100, maximum: 500000, nullable: true },
    intervalMonths: { type: "integer", minimum: 1, maximum: 240, nullable: true },
    criticality: {
      type: "string",
      enum: ["critical", "high", "medium", "low"],
      nullable: true,
    },
    lastServiceKm: { type: "integer", minimum: 0, maximum: 3000000, nullable: true },
    lastServiceDate: { type: "string", format: "date", nullable: true },
    note: { type: "string", maxLength: 300, nullable: true },
  },
  required: ["name", "category", "dueType"],
};
