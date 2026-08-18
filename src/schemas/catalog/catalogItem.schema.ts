import { JSONSchemaType } from "ajv";
import { CatalogItemPayload } from "../../services/catalog/catalog.service";
import { CATEGORIES } from "../../types/catalog";

const FUELS = ["flex", "gasoline", "ethanol", "diesel", "cng", "hybrid", "electric"];
const TRANSMISSIONS = ["manual", "automatic", "cvt", "automated"];

export const catalogItemSchema: JSONSchemaType<CatalogItemPayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    code: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_]{2,39}$" },
    name: { type: "string", minLength: 2, maxLength: 80 },
    category: { type: "string", enum: CATEGORIES },
    dueType: { type: "string", enum: ["km", "time", "both", "inspection"] },
    defaultIntervalKm: {
      type: "integer",
      minimum: 100,
      maximum: 500000,
      nullable: true,
    },
    defaultIntervalMonths: {
      type: "integer",
      minimum: 1,
      maximum: 240,
      nullable: true,
    },
    criticality: {
      type: "string",
      enum: ["critical", "high", "medium", "low"],
    },
    whatItIs: { type: "string", minLength: 10, maxLength: 300 },
    whyItMatters: { type: "string", minLength: 10, maxLength: 300 },
    appliesTo: {
      type: "object",
      additionalProperties: false,
      nullable: true,
      properties: {
        fuel: {
          type: "array",
          nullable: true,
          items: { type: "string", enum: FUELS as any },
        },
        transmission: {
          type: "array",
          nullable: true,
          items: { type: "string", enum: TRANSMISSIONS as any },
        },
        note: { type: "string", maxLength: 200, nullable: true },
      },
      required: [],
    },
    bundledWith: {
      type: "array",
      nullable: true,
      items: { type: "string", pattern: "^[A-Z][A-Z0-9_]{2,39}$" },
    },
    active: { type: "boolean", nullable: true },
  },
  required: [
    "code",
    "name",
    "category",
    "dueType",
    "criticality",
    "whatItIs",
    "whyItMatters",
  ],
};
