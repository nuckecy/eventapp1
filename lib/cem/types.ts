// Shared CEM types + constants. This module has NO server-only
// imports so client components can safely use it.

export type EventType = "sunday" | "regional" | "local";

export const EVENT_TYPES: readonly EventType[] = ["sunday", "regional", "local"] as const;

export type EventListItem = {
  id: string;
  title: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  time: string | null;
  location: string | null;
  description: string | null;
  expected_attendance: number | null;
  department_id: string | null;
  department_name: string | null;
};

// ── Holiday types (F09) ─────────────────────────────────────────────

export type HolidayType = "public" | "church" | "special";

export const HOLIDAY_TYPES: readonly HolidayType[] = [
  "public",
  "church",
  "special",
] as const;

export type HolidayListItem = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
  note: string | null;
  year: number;
};

// ── Birthday types (F10) ────────────────────────────────────────────
//
// SECURITY: This DTO intentionally has NO `year` field. PRD Section
// 16, key rule #6: "Birthday year is NEVER returned in public or
// authenticated birthday list endpoints. Only /api/me/birthday (own
// data) and admin endpoints with ?admin=true return year."
//
// The query layer (lib/cem/birthdays.ts) does NOT select the year
// column. The server computes `isLandmark` and `landmarkColor` from
// the year, then drops it. For admin viewers, the server additionally
// computes `age` so the UI can render "Turning {age}", but the raw
// year is still never returned.

export type LandmarkColor = "blue" | "green";

export type BirthdayListItem = {
  id: string;
  user_id: string;
  name: string;
  day: number; // 1-31
  month: number; // 1-12 (DB-native)
  department_id: string | null;
  department_name: string | null;
  /** True if the row should display a landmark tag for the current
   *  viewer. The server applies the visibility rules (showAge × role)
   *  before setting this. Clients must not infer or override. */
  isLandmark: boolean;
  /** Set only when `isLandmark=true`. */
  landmarkColor: LandmarkColor | null;
  /** Set only when the viewer is admin/superadmin/platform_admin AND
   *  the row is a landmark. The "Turning {age}" tag uses this. For
   *  non-admin viewers this is always null. The raw year is never
   *  exposed; only this derived integer. */
  age: number | null;
};
