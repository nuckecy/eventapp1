// Date utilities used across CEM views. Pure functions — no I/O.

export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Parse a YYYY-MM-DD date string into its parts. Local-time semantics
 * (the calendar is a wall-clock calendar; timezones don't apply).
 */
export function parseEventDate(dateStr: string): {
  year: number;
  month: number; // 0-11
  dayNum: number; // 1-31
  dayShort: (typeof DAYS_SHORT)[number];
} {
  // Force midnight local time, not UTC, so a "2026-04-05" event on
  // a user east of UTC doesn't render as April 4.
  const d = new Date(`${dateStr}T00:00:00`);
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    dayNum: d.getDate(),
    dayShort: DAYS_SHORT[d.getDay()],
  };
}

/**
 * The "today" anchor used to split events into past vs. current/future.
 * Returns a YYYY-MM-DD string in local time. Centralised here so
 * tests can mock it consistently.
 */
export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
