import { Schema } from "mongoose";
import { defaultPreferences } from "../domain/preferences";
import { UserDocument } from "../types/user";

const quietHoursSchema = new Schema(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false },
);

const milestonesSchema = new Schema(
  {
    D30: { type: Boolean, default: true },
    D7: { type: Boolean, default: true },
    D0: { type: Boolean, default: true },
    OVERDUE_WEEKLY: { type: Boolean, default: true },
  },
  { _id: false },
);

const preferencesSchema = new Schema(
  {
    pushEnabled: { type: Boolean, default: true },
    milestones: { type: milestonesSchema, default: () => ({}) },
    quietHours: { type: quietHoursSchema, default: null },
    timezone: { type: String, default: "America/Fortaleza" },
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
  },
  { _id: false },
);

export const userSchema = new Schema<UserDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    cognitoSub: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    role: { type: String, enum: ["owner", "driver", "admin"], required: true },
    preferences: { type: preferencesSchema, default: defaultPreferences },
    lgpdAcceptedAt: { type: Date, default: null },
    lgpdTermsVersion: { type: String, default: null },
  },
  { timestamps: true, collection: "users" },
);

userSchema.index({ cognitoSub: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ accountId: 1 });
