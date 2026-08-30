const GENERIC_PATTERN = /^[PCBU]0[0-9A-F]{3}$/;
const MANUFACTURER_PATTERN = /^[PCBU][123][0-9A-F]{3}$/;

export const normalizeCode = (code: string): string =>
  code.trim().toUpperCase();

export const isGenericCode = (code: string): boolean =>
  GENERIC_PATTERN.test(normalizeCode(code));

export const isManufacturerCode = (code: string): boolean =>
  MANUFACTURER_PATTERN.test(normalizeCode(code));

export const isValidCode = (code: string): boolean =>
  isGenericCode(code) || isManufacturerCode(code);
