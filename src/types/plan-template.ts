import { Types } from "mongoose";
import { Fuel, Transmission } from "./vehicle";

export interface PlanTemplateCriteria {
  fuel?: Fuel[];
  transmission?: Transmission[];
  yearMin?: number | null;
  yearMax?: number | null;
}

export interface PlanTemplateItem {
  catalogItemCode: string;
  intervalKm?: number | null;
  intervalMonths?: number | null;
  activeByDefault: boolean;
}

export interface PlanTemplateDocument {
  _id?: Types.ObjectId;
  name: string;
  criteria: PlanTemplateCriteria;
  items: PlanTemplateItem[];
  priority: number;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
