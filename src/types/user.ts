import { Types } from "mongoose";
import { Role } from "./auth";

export type Plan = "free" | "pro";
export type Theme = "light" | "dark" | "system";
export type Milestone = "D30" | "D7" | "D0" | "OVERDUE_WEEKLY";

export interface QuietHours {
  start: string;
  end: string;
}

export interface MilestonePreferences {
  D30: boolean;
  D7: boolean;
  D0: boolean;
  OVERDUE_WEEKLY: boolean;
}

export interface UserPreferences {
  pushEnabled: boolean;
  milestones: MilestonePreferences;
  quietHours: QuietHours | null;
  timezone: string;
  theme: Theme;
}

export type AccountStatus = "active" | "pending_deletion" | "anonymized";

export interface AccountDocument {
  _id?: Types.ObjectId;
  name: string;
  ownerId: Types.ObjectId;
  plan: Plan;
  vehicleLimit: number;
  status: AccountStatus;
  deletionRequestedAt?: Date | null;
  purgeAfter?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  cognitoSub: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  preferences: UserPreferences;
  lgpdAcceptedAt?: Date | null;
  lgpdTermsVersion?: string | null;
  anonymizedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Requester {
  userId: Types.ObjectId;
  accountId: Types.ObjectId;
  role: Role;
  user: UserDocument;
}
