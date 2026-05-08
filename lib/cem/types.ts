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
