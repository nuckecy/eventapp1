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

// ── Month-grid helpers (F07) ────────────────────────────────────────

/** A single cell in the 7×N month grid. */
export type MonthGridCell = {
  /** Date in YYYY-MM-DD. */
  iso: string;
  /** Day-of-month, 1–31. */
  day: number;
  /** True if this cell is from the previous or next month
   *  (rendered dimmed per the FR-1 spec). */
  outsideMonth: boolean;
};

/** A {year, month} pair. month is 0–11. */
export type YearMonth = { year: number; month: number };

/**
 * Parse a `?month=YYYY-MM` URL param. Returns null if absent or
 * malformed. Range-checks year (1900–9999) and month (1–12).
 */
export function parseMonthParam(raw: string | undefined | null): YearMonth | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const year = Number(m[1]);
  const month1 = Number(m[2]);
  if (!Number.isInteger(year) || year < 1900 || year > 9999) return null;
  if (!Number.isInteger(month1) || month1 < 1 || month1 > 12) return null;
  return { year, month: month1 - 1 };
}

/** Format a YearMonth back to YYYY-MM for the URL. */
export function formatMonthParam(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month + 1).padStart(2, "0")}`;
}

/** Human label for the month nav, e.g. "April 2026". */
export function formatMonthLabel(ym: YearMonth): string {
  return `${MONTHS_LONG[ym.month]} ${ym.year}`;
}

/** YearMonth representing today. */
export function thisMonth(now: Date = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() };
}

/** Return the previous month (handles year rollover). */
export function prevMonth({ year, month }: YearMonth): YearMonth {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

/** Return the next month (handles year rollover). */
export function nextMonth({ year, month }: YearMonth): YearMonth {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth({ year, month }: YearMonth): number {
  // JS trick: day 0 of next month = last day of this month.
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Build the 7×N grid for a given month, including overflow days from
 * the previous month (so the first row starts on Sunday) and from
 * the next month (so the last row is full). Total cell count is
 * always a multiple of 7 — typically 35 or 42 cells.
 */
export function monthGridCells(ym: YearMonth): MonthGridCell[] {
  const cells: MonthGridCell[] = [];

  // Day-of-week for the 1st of the month (0 = Sun … 6 = Sat).
  const firstWeekday = new Date(ym.year, ym.month, 1).getDay();

  // Lead-in: previous-month overflow (firstWeekday cells).
  if (firstWeekday > 0) {
    const prev = prevMonth(ym);
    const prevLast = daysInMonth(prev);
    const start = prevLast - firstWeekday + 1;
    for (let d = start; d <= prevLast; d++) {
      cells.push({
        iso: `${prev.year}-${pad(prev.month + 1)}-${pad(d)}`,
        day: d,
        outsideMonth: true,
      });
    }
  }

  // Current month.
  const last = daysInMonth(ym);
  for (let d = 1; d <= last; d++) {
    cells.push({
      iso: `${ym.year}-${pad(ym.month + 1)}-${pad(d)}`,
      day: d,
      outsideMonth: false,
    });
  }

  // Trail: next-month overflow to round out the last week.
  const remainder = cells.length % 7;
  if (remainder > 0) {
    const next = nextMonth(ym);
    const trail = 7 - remainder;
    for (let d = 1; d <= trail; d++) {
      cells.push({
        iso: `${next.year}-${pad(next.month + 1)}-${pad(d)}`,
        day: d,
        outsideMonth: true,
      });
    }
  }

  return cells;
}
