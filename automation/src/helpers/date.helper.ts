/**
 * Returns an ISO date string (YYYY-MM-DD) offset by the given number of days from today.
 */
export function getDateOffset(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export const today = (): string => getDateOffset(0);
export const tomorrow = (): string => getDateOffset(1);

/** Returns the next Monday–Friday date (skips weekends). */
export function nextWeekday(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
