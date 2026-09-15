export type FuelTrend = "stable" | "drop" | "rise";

export interface FuelFill {
  id: string;
  date: Date;
  odometerKm: number;
  liters: number;
  fullTank: boolean;
  totalCents: number | null;
  fuelKind: string;
}

export interface FuelFillMetrics {
  id: string;
  distanceKm: number | null;
  litersCounted: number | null;
  kmPerLiter: number | null;
  pricePerLiterCents: number | null;
  costPerKmCents: number | null;
}

export interface FuelKindSummary {
  fuelKind: string;
  fills: number;
  averageKmPerLiter: number | null;
}

export interface FuelSummary {
  fills: number;
  measuredFills: number;
  totalLiters: number;
  totalCents: number;
  totalDistanceKm: number;
  averageKmPerLiter: number | null;
  lastKmPerLiter: number | null;
  bestKmPerLiter: number | null;
  worstKmPerLiter: number | null;
  costPerKmCents: number | null;
  trend: FuelTrend | null;
  byFuelKind: FuelKindSummary[];
}

export const TREND_TOLERANCE = 0.1;
const MIN_FILLS_FOR_TREND = 3;

interface MeasuredSegment {
  fillId: string;
  fuelKind: string;
  distanceKm: number;
  liters: number;
  cents: number | null;
}

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const ratio = (distanceKm: number, liters: number): number | null =>
  distanceKm > 0 && liters > 0 ? round(distanceKm / liters, 2) : null;

const perKmCents = (cents: number | null, distanceKm: number): number | null =>
  cents === null || distanceKm <= 0 ? null : Math.round(cents / distanceKm);

export const sortFills = (fills: FuelFill[]): FuelFill[] =>
  [...fills].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() || a.odometerKm - b.odometerKm,
  );

const emptyMetrics = (id: string): FuelFillMetrics => ({
  id,
  distanceKm: null,
  litersCounted: null,
  kmPerLiter: null,
  pricePerLiterCents: null,
  costPerKmCents: null,
});

const pricePerLiter = (fill: FuelFill): number | null =>
  fill.totalCents === null || fill.liters <= 0
    ? null
    : Math.round(fill.totalCents / fill.liters);

export const measureFills = (
  fills: FuelFill[],
): { metrics: FuelFillMetrics[]; segments: MeasuredSegment[] } => {
  const ordered = sortFills(fills);
  const metrics: FuelFillMetrics[] = [];
  const segments: MeasuredSegment[] = [];

  let anchorKm: number | null = null;
  let litersSinceAnchor = 0;
  let centsSinceAnchor: number | null = 0;

  for (const fill of ordered) {
    litersSinceAnchor += fill.liters;
    centsSinceAnchor =
      centsSinceAnchor === null || fill.totalCents === null
        ? null
        : centsSinceAnchor + fill.totalCents;

    const base = { ...emptyMetrics(fill.id), pricePerLiterCents: pricePerLiter(fill) };

    if (!fill.fullTank) {
      metrics.push(base);
      continue;
    }

    if (anchorKm !== null) {
      const distanceKm = fill.odometerKm - anchorKm;
      const kmPerLiter = ratio(distanceKm, litersSinceAnchor);

      metrics.push({
        ...base,
        distanceKm,
        litersCounted: round(litersSinceAnchor, 3),
        kmPerLiter,
        costPerKmCents: kmPerLiter === null ? null : perKmCents(centsSinceAnchor, distanceKm),
      });

      if (kmPerLiter !== null) {
        segments.push({
          fillId: fill.id,
          fuelKind: fill.fuelKind,
          distanceKm,
          liters: litersSinceAnchor,
          cents: centsSinceAnchor,
        });
      }
    } else {
      metrics.push(base);
    }

    anchorKm = fill.odometerKm;
    litersSinceAnchor = 0;
    centsSinceAnchor = 0;
  }

  return { metrics, segments };
};

const weightedKmPerLiter = (segments: MeasuredSegment[]): number | null => {
  const distance = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  const liters = segments.reduce((sum, segment) => sum + segment.liters, 0);
  return ratio(distance, liters);
};

const detectTrend = (segments: MeasuredSegment[]): FuelTrend | null => {
  if (segments.length < MIN_FILLS_FOR_TREND) return null;

  const previous = weightedKmPerLiter(segments.slice(0, -1)) as number;
  const last = segments[segments.length - 1];
  const lastKmPerLiter = last.distanceKm / last.liters;

  if (lastKmPerLiter < previous * (1 - TREND_TOLERANCE)) return "drop";
  if (lastKmPerLiter > previous * (1 + TREND_TOLERANCE)) return "rise";
  return "stable";
};

const costPerKm = (segments: MeasuredSegment[]): number | null => {
  const priced = segments.filter((segment) => segment.cents !== null);
  if (!priced.length) return null;

  const cents = priced.reduce((sum, segment) => sum + (segment.cents as number), 0);
  const distance = priced.reduce((sum, segment) => sum + segment.distanceKm, 0);
  return perKmCents(cents, distance);
};

const groupByFuelKind = (segments: MeasuredSegment[]): FuelKindSummary[] => {
  const groups = new Map<string, MeasuredSegment[]>();

  for (const segment of segments) {
    const bucket = groups.get(segment.fuelKind) ?? [];
    bucket.push(segment);
    groups.set(segment.fuelKind, bucket);
  }

  return [...groups.entries()].map(([fuelKind, bucket]) => ({
    fuelKind,
    fills: bucket.length,
    averageKmPerLiter: weightedKmPerLiter(bucket),
  }));
};

export const summarizeFuel = (fills: FuelFill[]): FuelSummary => {
  const { segments } = measureFills(fills);
  const ratios = segments.map((segment) => round(segment.distanceKm / segment.liters, 2));

  return {
    fills: fills.length,
    measuredFills: segments.length,
    totalLiters: round(fills.reduce((sum, fill) => sum + fill.liters, 0), 3),
    totalCents: fills.reduce((sum, fill) => sum + (fill.totalCents ?? 0), 0),
    totalDistanceKm: segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
    averageKmPerLiter: weightedKmPerLiter(segments),
    lastKmPerLiter: ratios.length ? ratios[ratios.length - 1] : null,
    bestKmPerLiter: ratios.length ? Math.max(...ratios) : null,
    worstKmPerLiter: ratios.length ? Math.min(...ratios) : null,
    costPerKmCents: costPerKm(segments),
    trend: detectTrend(segments),
    byFuelKind: groupByFuelKind(segments),
  };
};

const FUEL_KINDS_BY_VEHICLE_FUEL: Record<string, string[]> = {
  flex: ["gasoline", "ethanol"],
  gasoline: ["gasoline"],
  ethanol: ["ethanol"],
  diesel: ["diesel"],
  cng: ["cng", "gasoline", "ethanol"],
  hybrid: ["gasoline", "ethanol"],
  electric: [],
};

export const allowedFuelKinds = (vehicleFuel: string): string[] =>
  FUEL_KINDS_BY_VEHICLE_FUEL[vehicleFuel] ?? [];

export const acceptsFuelKind = (vehicleFuel: string, fuelKind: string): boolean =>
  allowedFuelKinds(vehicleFuel).includes(fuelKind);
