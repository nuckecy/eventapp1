// EventRow — the single-line event listing per PRD Section 6
// "Component Patterns / Event Rows":
//
//   [date col 36px] [3px color bar] [title][time][location] [type badge]
//
// - Date column: 36px wide, day abbreviation 9px/600 above, day number
//   20px/400 below.
// - 3px color bar in the event-type color.
// - Inline title (13px/500), time + location (12px/400, secondary/muted).
// - Type badge on the right with tinted bg + thin colored border.
// - Hover: --cal-bg-subtle background, 10px vertical padding.
//
// Server component — no client-side interactivity. Clicking an event
// will be wired in F07 (Event Detail Modal), which has its own client
// component.

import type { EventListItem } from "@/lib/cem/types";
import { parseEventDate } from "@/lib/cem/dates";

type EventTypeStyle = {
  label: string;
  hex: string; // base color for the bar + badge text
};

const EVENT_TYPE_STYLES: Record<EventListItem["type"], EventTypeStyle> = {
  sunday: { label: "Sunday", hex: "#0d9488" },
  regional: { label: "Regional", hex: "#7c3aed" },
  local: { label: "Local", hex: "#111827" },
};

export function EventRow({ event, isLast }: { event: EventListItem; isLast: boolean }) {
  const { dayShort, dayNum } = parseEventDate(event.date);
  const style = EVENT_TYPE_STYLES[event.type];
  // EC-07: cancelled event visual treatment.
  const isCancelled = event.cancelled_at !== null;

  return (
    <div
      className={`flex items-center gap-3.5 px-6 py-2.5 transition-colors hover:bg-cal-bg-subtle ${
        isLast ? "" : "border-b border-cal-border"
      }`}
    >
      {/* Date column */}
      <div className="w-9 shrink-0 text-center">
        <div className="text-[9px] font-semibold uppercase leading-none tracking-[0.08em] text-cal-text-muted">
          {dayShort}
        </div>
        <div className="font-display text-[20px] font-normal leading-snug text-cal-text">
          {dayNum}
        </div>
      </div>

      {/* 3px color bar */}
      <div
        className="h-6 w-[3px] shrink-0 rounded-sm"
        style={{ backgroundColor: isCancelled ? "var(--cal-text-muted)" : style.hex }}
        aria-hidden="true"
      />

      {/* Title + meta — wraps if narrow */}
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
        <span
          className={`whitespace-nowrap text-[13px] font-medium ${
            isCancelled ? "text-cal-text-muted line-through" : "text-cal-text"
          }`}
        >
          {event.title}
        </span>
        {event.time ? (
          <span
            className={`whitespace-nowrap text-[12px] ${
              isCancelled ? "text-cal-text-muted line-through" : "text-cal-text-secondary"
            }`}
          >
            {event.time}
          </span>
        ) : null}
        {event.location ? (
          <span className="whitespace-nowrap text-[12px] text-cal-text-muted">
            {event.location}
          </span>
        ) : null}
      </div>

      {/* Cancelled badge takes precedence over type badge. */}
      {isCancelled ? (
        <span
          className="inline-flex shrink-0 items-center whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
          style={{
            color: "#dc2626",
            backgroundColor: "#fef2f2",
            borderColor: "#fecaca",
          }}
        >
          Cancelled
        </span>
      ) : (
        <span
          className="inline-flex shrink-0 items-center whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-medium"
          style={{
            color: style.hex,
            backgroundColor: `${style.hex}10`,
            borderColor: `${style.hex}25`,
          }}
        >
          {style.label}
        </span>
      )}
    </div>
  );
}
