import { planTemplateSchema } from "../models/planTemplate.model";
import { PlanTemplateDocument } from "../types/plan-template";
import { createInstanceMongoose } from "./base";

export const planTemplateRepository =
  createInstanceMongoose<PlanTemplateDocument>(
    "planTemplates",
    planTemplateSchema,
  );
