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
  /** EC-07: non-null = cancelled. Calendar renders strikethrough + badge. */
  cancelled_at: Date | null;
  cancellation_reason: string | null;
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

// ── Request types (F14-F16) ────────────────────────────────────────

export type RequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "ready_for_approval"
  | "approved"
  | "returned"
  | "deleted"
  | "cancelled"; // EC-07

export type EventRequestType = "sunday" | "regional" | "local";

/** Status badge palette per PRD Section 6. Client-safe (no DB code). */
export const STATUS_STYLES: Record<
  RequestStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  draft: { label: "Draft", bg: "#f9fafb", text: "#4b5563", border: "#d1d5db" },
  submitted: { label: "Submitted", bg: "#f0f9ff", text: "#0c4a6e", border: "#bae6fd" },
  under_review: {
    label: "Under Review",
    bg: "#fefce8",
    text: "#854d0e",
    border: "#fde68a",
  },
  ready_for_approval: {
    label: "Ready for Approval",
    bg: "#f0fdf4",
    text: "#166534",
    border: "#bbf7d0",
  },
  approved: { label: "Approved", bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  returned: { label: "Returned", bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
  deleted: { label: "Deleted", bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
  // EC-07
  cancelled: { label: "Cancelled", bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
};

export type RequestListItem = {
  id: string;
  title: string;
  type: EventRequestType;
  status: RequestStatus;
  date: string | null;
  time: string | null;
  location: string | null;
  description: string | null;
  expected_attendance: number | null;
  budget: number | null;
  department_id: string | null;
  department_name: string | null;
  submitted_by: string | null;
  claimed_by: string | null;
  approved_by: string | null;
  submitted_at: Date | null;
  claimed_at: Date | null;
  forwarded_at: Date | null;
  approved_at: Date | null;
  created_at: Date | null;
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
