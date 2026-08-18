export interface OdometerReminderJobResult {
  vehiclesChecked: number;
  remindersEnqueued: number;
}

export const runOdometerReminder =
  async (): Promise<OdometerReminderJobResult> => ({
    vehiclesChecked: 0,
    remindersEnqueued: 0,
  });
