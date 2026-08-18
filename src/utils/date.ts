const BRAZIL_OFFSET_HOURS = 3;
const BRAZIL_OFFSET_MS = BRAZIL_OFFSET_HOURS * 60 * 60 * 1000;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const startOfLocalDay = (reference: Date = new Date()): Date => {
  const local = new Date(reference.getTime() - BRAZIL_OFFSET_MS);
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      BRAZIL_OFFSET_HOURS,
    ),
  );
};

export const today = (): Date => startOfLocalDay();

export const daysBetween = (to: Date, from: Date): number =>
  Math.round(
    (startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) /
      MS_PER_DAY,
  );

export const addDays = (date: Date, days: number): Date => {
  const base = startOfLocalDay(date);
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + days,
      BRAZIL_OFFSET_HOURS,
    ),
  );
};

export const addMonths = (date: Date, months: number): Date => {
  const base = startOfLocalDay(date);
  const targetMonth = base.getUTCMonth() + months;
  const candidate = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      targetMonth,
      base.getUTCDate(),
      BRAZIL_OFFSET_HOURS,
    ),
  );

  if (candidate.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
    return new Date(
      Date.UTC(
        base.getUTCFullYear(),
        targetMonth + 1,
        0,
        BRAZIL_OFFSET_HOURS,
      ),
    );
  }
  return candidate;
};

export const earliest = (...dates: (Date | null | undefined)[]): Date | null => {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  if (!valid.length) return null;
  return valid.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
};
