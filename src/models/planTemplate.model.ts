import { Schema } from "mongoose";
import { PlanTemplateDocument } from "../types/plan-template";

const criteriaSchema = new Schema(
  {
    fuel: { type: [String], default: [] },
    transmission: { type: [String], default: [] },
    yearMin: { type: Number, default: null },
    yearMax: { type: Number, default: null },
  },
  { _id: false },
);

const templateItemSchema = new Schema(
  {
    catalogItemCode: { type: String, required: true, uppercase: true },
    intervalKm: { type: Number, default: null },
    intervalMonths: { type: Number, default: null },
    activeByDefault: { type: Boolean, default: false },
  },
  { _id: false },
);

export const planTemplateSchema = new Schema<PlanTemplateDocument>(
  {
    name: { type: String, required: true, trim: true },
    criteria: { type: criteriaSchema, default: () => ({}) },
    items: { type: [templateItemSchema], default: [] },
    priority: { type: Number, default: 0, required: true },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, collection: "planTemplates" },
);

planTemplateSchema.index({ name: 1 }, { unique: true });
planTemplateSchema.index({ active: 1, priority: -1 });
