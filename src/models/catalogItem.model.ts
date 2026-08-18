import { Schema } from "mongoose";
import { CATEGORIES, CatalogItemDocument } from "../types/catalog";

const appliesToSchema = new Schema(
  {
    fuel: { type: [String], default: undefined },
    transmission: { type: [String], default: undefined },
    note: { type: String, default: null },
  },
  { _id: false },
);

export const catalogItemSchema = new Schema<CatalogItemDocument>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    dueType: {
      type: String,
      enum: ["km", "time", "both", "inspection"],
      required: true,
    },
    defaultIntervalKm: { type: Number, default: null },
    defaultIntervalMonths: { type: Number, default: null },
    criticality: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      required: true,
    },
    whatItIs: { type: String, required: true },
    whyItMatters: { type: String, required: true },
    appliesTo: { type: appliesToSchema, default: null },
    bundledWith: { type: [String], default: [] },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, collection: "catalogItems" },
);

catalogItemSchema.index({ code: 1 }, { unique: true });
catalogItemSchema.index({ category: 1, active: 1 });
