export interface RecalculateHealthJobResult {
  vehiclesProcessed: number;
  alertsCreated: number;
  vehiclesEnqueued: number;
}

export const runRecalculateHealth =
  async (): Promise<RecalculateHealthJobResult> => ({
    vehiclesProcessed: 0,
    alertsCreated: 0,
    vehiclesEnqueued: 0,
  });
