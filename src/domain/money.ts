export interface CostBearing {
  partCents?: number | null;
  laborCents?: number | null;
}

export const sumCents = (values: (number | null | undefined)[]): number =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0);

export const computeEventTotalCents = (
  items: CostBearing[],
  laborCents?: number | null,
): number =>
  sumCents([
    ...items.map((item) => item.partCents),
    ...items.map((item) => item.laborCents),
    laborCents,
  ]);
