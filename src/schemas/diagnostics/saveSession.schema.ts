import { JSONSchemaType } from "ajv";
import { SaveDiagnosticSessionPayload } from "../../services/diagnostics/diagnostics.service";

const troubleCodes = {
  type: "object",
  additionalProperties: false,
  properties: {
    supported: { type: "boolean" },
    codes: { type: "array", items: { type: "string", maxLength: 8 } },
  },
  required: ["supported", "codes"],
};

export const saveSessionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    startedAt: { type: "string", format: "date-time" },
    deviceName: { type: "string", minLength: 1, maxLength: 120 },
    adapterIdentity: { type: "string", maxLength: 120, nullable: true },
    protocol: { type: "string", maxLength: 120, nullable: true },
    voltage: { type: "number", minimum: 0, maximum: 60, nullable: true },
    malfunctionLightOn: { type: "boolean", nullable: true },
    storedCodes: { type: "integer", minimum: 0, maximum: 255, nullable: true },
    troubleCodes: {
      type: "object",
      additionalProperties: false,
      properties: {
        confirmed: troubleCodes,
        pending: troubleCodes,
        permanent: troubleCodes,
      },
      required: ["confirmed", "pending", "permanent"],
    },
    monitors: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", maxLength: 60 },
          complete: { type: "boolean" },
        },
        required: ["name", "complete"],
      },
    },
    supportedPids: {
      type: "array",
      maxItems: 200,
      items: { type: "string", maxLength: 6 },
    },
    readings: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          command: { type: "string", maxLength: 6 },
          label: { type: "string", maxLength: 80 },
          unit: { type: "string", maxLength: 12 },
          value: { type: "number", nullable: true },
          text: { type: "string", maxLength: 120, nullable: true },
          answered: { type: "boolean" },
          supported: { type: "boolean" },
        },
        required: ["command", "label", "unit", "answered", "supported"],
      },
    },
    trip: {
      type: "array",
      maxItems: 80,
      nullable: true,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          command: { type: "string", maxLength: 6 },
          label: { type: "string", maxLength: 80 },
          unit: { type: "string", maxLength: 12 },
          minimum: { type: "number" },
          average: { type: "number" },
          maximum: { type: "number" },
          samples: { type: "integer", minimum: 0 },
        },
        required: [
          "command",
          "label",
          "unit",
          "minimum",
          "average",
          "maximum",
          "samples",
        ],
      },
    },
    sampleCount: {
      type: "integer",
      minimum: 0,
      maximum: 1000000,
      nullable: true,
    },
    tripStats: {
      type: "object",
      nullable: true,
      additionalProperties: false,
      properties: {
        distanceKm: { type: "number", minimum: 0, maximum: 5000 },
        averageSpeedKmh: { type: "number", minimum: 0, maximum: 400 },
        movingSeconds: { type: "integer", minimum: 0, maximum: 200000 },
        idleRatio: { type: "number", minimum: 0, maximum: 1 },
      },
      required: [
        "distanceKm",
        "averageSpeedKmh",
        "movingSeconds",
        "idleRatio",
      ],
    },
    modules: {
      type: "array",
      nullable: true,
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          address: { type: "string", maxLength: 8 },
          codes: { type: "array", maxItems: 30, items: { type: "string", maxLength: 8 } },
          identified: { type: "boolean" },
        },
        required: ["address", "codes", "identified"],
      },
    },
    findings: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string", maxLength: 40 },
          title: { type: "string", maxLength: 200 },
          why: { type: "string", maxLength: 600 },
          priority: { type: "string", enum: ["now", "soon", "whenever"] },
        },
        required: ["code", "title", "why", "priority"],
      },
    },
  },
  required: [
    "startedAt",
    "deviceName",
    "troubleCodes",
    "monitors",
    "supportedPids",
    "readings",
    "findings",
  ],
} as unknown as JSONSchemaType<SaveDiagnosticSessionPayload>;
