import { planItemSchema } from "../models/planItem.model";
import { PlanItemDocument } from "../types/plan-item";
import { createInstanceMongoose } from "./base";

export const planItemRepository = createInstanceMongoose<PlanItemDocument>(
  "planItems",
  planItemSchema,
);
