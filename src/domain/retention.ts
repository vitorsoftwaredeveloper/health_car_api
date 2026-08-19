export const PURGE_GRACE_DAYS = 30;

export const purgeDateFrom = (reference: Date): Date => {
  const purge = new Date(reference.getTime());
  purge.setUTCDate(purge.getUTCDate() + PURGE_GRACE_DAYS);
  return purge;
};

export const isPurgeDue = (purgeAfter: Date | null | undefined, now: Date): boolean =>
  !!purgeAfter && purgeAfter.getTime() <= now.getTime();
