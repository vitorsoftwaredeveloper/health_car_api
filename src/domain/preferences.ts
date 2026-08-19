import {
  MilestonePreferences,
  Milestone,
  QuietHours,
  Theme,
  UserPreferences,
} from "../types/user";

export const DEFAULT_TIMEZONE = "America/Fortaleza";

export const MILESTONES: Milestone[] = ["D30", "D7", "D0", "OVERDUE_WEEKLY"];

export const defaultPreferences = (): UserPreferences => ({
  pushEnabled: true,
  milestones: { D30: true, D7: true, D0: true, OVERDUE_WEEKLY: true },
  quietHours: { start: "22:00", end: "06:00" },
  timezone: DEFAULT_TIMEZONE,
  theme: "system",
});

export interface PreferencesPatch {
  pushEnabled?: boolean;
  milestones?: Partial<MilestonePreferences>;
  quietHours?: QuietHours | null;
  timezone?: string;
  theme?: Theme;
}

export const mergePreferences = (
  current: UserPreferences | undefined,
  patch: PreferencesPatch,
): UserPreferences => {
  const base = { ...defaultPreferences(), ...(current ?? {}) };

  return {
    pushEnabled: patch.pushEnabled ?? base.pushEnabled,
    milestones: { ...base.milestones, ...(patch.milestones ?? {}) },
    quietHours:
      patch.quietHours === undefined ? base.quietHours : patch.quietHours,
    timezone: patch.timezone ?? base.timezone,
    theme: patch.theme ?? base.theme,
  };
};

export const isMilestoneEnabled = (
  preferences: UserPreferences,
  milestone: string,
): boolean => {
  if (milestone.startsWith("OVERDUE_W")) {
    return preferences.milestones.OVERDUE_WEEKLY;
  }
  return preferences.milestones[milestone as keyof MilestonePreferences] ?? true;
};

const toMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
};

export const isWithinQuietHours = (
  quietHours: QuietHours | null,
  localTime: string,
): boolean => {
  if (!quietHours) return false;

  const now = toMinutes(localTime);
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);

  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
};
