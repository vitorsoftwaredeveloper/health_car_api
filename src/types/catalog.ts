import { Types } from "mongoose";
import { Criticality, DueType } from "./plan";
import { Fuel, Transmission } from "./vehicle";

export type Category =
  | "engine"
  | "cooling"
  | "brakes"
  | "transmission"
  | "steering_suspension"
  | "tires"
  | "electrical"
  | "hvac"
  | "body";

export interface CatalogAppliesTo {
  fuel?: Fuel[];
  transmission?: Transmission[];
  note?: string;
}

export interface CatalogItemDocument {
  _id?: Types.ObjectId;
  code: string;
  name: string;
  category: Category;
  dueType: DueType;
  defaultIntervalKm?: number | null;
  defaultIntervalMonths?: number | null;
  criticality: Criticality;
  whatItIs: string;
  whyItMatters: string;
  appliesTo?: CatalogAppliesTo | null;
  bundledWith?: string[];
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const CATEGORIES: Category[] = [
  "engine",
  "cooling",
  "brakes",
  "transmission",
  "steering_suspension",
  "tires",
  "electrical",
  "hvac",
  "body",
];
