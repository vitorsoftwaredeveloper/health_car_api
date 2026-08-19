import { JSONSchemaType } from "ajv";
import { RegisterMaintenancePayload } from "../../services/maintenance/maintenance.service";

export const registerMaintenanceSchema: JSONSchemaType<RegisterMaintenancePayload> =
  {
    type: "object",
    additionalProperties: false,
    properties: {
      date: { type: "string", format: "date", nullable: true },
      km: { type: "integer", minimum: 0, maximum: 3000000 },
      type: {
        type: "string",
        enum: ["preventive", "corrective", "scheduled", "inspection"],
        nullable: true,
      },
      workshop: {
        type: "object",
        additionalProperties: false,
        nullable: true,
        properties: {
          name: { type: "string", maxLength: 120, nullable: true },
          taxId: { type: "string", maxLength: 20, nullable: true },
          city: { type: "string", maxLength: 80, nullable: true },
          phone: { type: "string", maxLength: 20, nullable: true },
        },
        required: [],
      },
      items: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            planItemId: { type: "string", pattern: "^[a-fA-F0-9]{24}$", nullable: true },
            description: { type: "string", minLength: 2, maxLength: 200 },
            action: {
              type: "string",
              enum: ["replace", "repair", "inspect", "top_up"],
            },
            partBrand: { type: "string", maxLength: 60, nullable: true },
            partCents: { type: "integer", minimum: 0, maximum: 100000000, nullable: true },
            laborCents: { type: "integer", minimum: 0, maximum: 100000000, nullable: true },
          },
          required: ["description", "action"],
        },
      },
      laborCents: { type: "integer", minimum: 0, maximum: 100000000, nullable: true },
      note: { type: "string", maxLength: 500, nullable: true },
      attachmentIds: {
        type: "array",
        nullable: true,
        maxItems: 10,
        items: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      },
    },
    required: ["km", "items"],
  };
