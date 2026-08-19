import { isMilestoneEnabled, isWithinQuietHours } from "./preferences";
import { UserPreferences } from "../types/user";
import { NotificationSkipReason } from "../types/notification";

export interface NotifiableAlert {
  id: string;
  milestone: string;
  title: string;
  message: string;
  planItemId: string;
  itemName: string;
}

export interface NotificationContent {
  title: string;
  body: string;
  deepLink: string;
}

export interface NotificationDecisionInput {
  preferences: UserPreferences;
  alerts: NotifiableAlert[];
  hasActiveDevice: boolean;
  alreadyNotifiedToday: boolean;
  localTime: string;
}

export interface NotificationDecision {
  alerts: NotifiableAlert[];
  skipReason: NotificationSkipReason | null;
}

export const filterAlertsByPreferences = (
  alerts: NotifiableAlert[],
  preferences: UserPreferences,
): NotifiableAlert[] =>
  alerts.filter((alert) => isMilestoneEnabled(preferences, alert.milestone));

export const decideNotification = ({
  preferences,
  alerts,
  hasActiveDevice,
  alreadyNotifiedToday,
  localTime,
}: NotificationDecisionInput): NotificationDecision => {
  const wanted = filterAlertsByPreferences(alerts, preferences);

  if (!wanted.length) return { alerts, skipReason: "milestone_disabled" };
  if (!preferences.pushEnabled) return { alerts: wanted, skipReason: "push_disabled" };
  if (alreadyNotifiedToday) {
    return { alerts: wanted, skipReason: "already_sent_today" };
  }
  if (!hasActiveDevice) return { alerts: wanted, skipReason: "no_device" };
  if (isWithinQuietHours(preferences.quietHours, localTime)) {
    return { alerts: wanted, skipReason: "quiet_hours" };
  }

  return { alerts: wanted, skipReason: null };
};

export const buildNotificationContent = (
  vehicleNickname: string,
  vehicleId: string,
  alerts: NotifiableAlert[],
): NotificationContent => {
  if (alerts.length === 1) {
    const [alert] = alerts;
    return {
      title: alert.title,
      body: `${vehicleNickname}: ${alert.message}`,
      deepLink: `/vehicles/${vehicleId}?item=${alert.planItemId}`,
    };
  }

  const names = alerts.map((alert) => alert.itemName);
  const shown = names.slice(0, 2).join(" e ");
  const rest = names.length - 2;

  return {
    title: `${vehicleNickname}: ${alerts.length} itens pedindo atenção`,
    body: rest > 0 ? `${shown} e mais ${rest}.` : `${shown}.`,
    deepLink: `/vehicles/${vehicleId}`,
  };
};
