import { Types } from "mongoose";
import { Category } from "./catalog";
import { Criticality, DueReason, DueType, ItemStatus } from "./plan";

export interface PlanItemDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  catalogItemId?: Types.ObjectId | null;
  code?: string | null;
  custom: boolean;
  name: string;
  category: Category;
  dueType: DueType;
  intervalKm?: number | null;
  intervalMonths?: number | null;
  criticality: Criticality;
  customized: boolean;
  lastServiceKm?: number | null;
  lastServiceDate?: Date | null;
  lastServiceEventId?: Types.ObjectId | null;
  cycle: number;
  nextDueKm?: number | null;
  nextDueDate?: Date | null;
  dueDate?: Date | null;
  dueReason?: DueReason | null;
  status: ItemStatus;
  leadTimeDays: number;
  leadTimeKm: number;
  snoozedUntil?: Date | null;
  snoozedUntilKm?: number | null;
  muted: boolean;
  active: boolean;
  note?: string | null;
  calculatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
