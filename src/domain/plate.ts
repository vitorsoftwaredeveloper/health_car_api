const MERCOSUR_PATTERN = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const LEGACY_PATTERN = /^[A-Z]{3}[0-9]{4}$/;

export type PlateFormat = "mercosur" | "legacy";

export const normalizePlate = (plate: string): string =>
  plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

export const plateFormat = (plate: string): PlateFormat | null => {
  const normalized = normalizePlate(plate);

  if (MERCOSUR_PATTERN.test(normalized)) return "mercosur";
  if (LEGACY_PATTERN.test(normalized)) return "legacy";
  return null;
};

export const isValidPlate = (plate: string): boolean =>
  plateFormat(plate) !== null;

export const maskPlate = (plate: string): string => {
  const normalized = normalizePlate(plate);
  if (normalized.length < 4) return "•".repeat(normalized.length);
  return `${normalized.slice(0, 3)}${"•".repeat(normalized.length - 3)}`;
};
