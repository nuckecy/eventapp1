// MonthSection — header + bordered card of EventRows.
//
// Header format per PRD Section 6:
//   `MONTH | N EVENTS`  (uppercase, 11px, weight 500, pipe separator,
//                        --cal-text-secondary color)
//
// Past months render at 60% opacity (rule from FR-1).

import { EventRow } from "./event-row";
import type { EventListItem } from "@/lib/cem/types";
import { MONTHS_LONG } from "@/lib/cem/dates";

export function MonthSection({
  monthIndex,
  events,
  muted = false,
}: {
  monthIndex: number; // 0-11
  events: EventListItem[];
  muted?: boolean;
}) {
  const monthName = MONTHS_LONG[monthIndex];
  const count = events.length;
  return (
    <section style={{ opacity: muted ? 0.6 : 1 }}>
      <div className="mb-2 flex items-center px-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-cal-text-secondary">
          {monthName}
        </span>
        <span
          className="mx-2 text-[11px] font-medium tracking-[0.08em] text-cal-text-muted"
          aria-hidden="true"
        >
          |
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-cal-text-secondary">
          {count} {count === 1 ? "EVENT" : "EVENTS"}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg">
        {events.map((e, i) => (
          <EventRow key={e.id} event={e} isLast={i === events.length - 1} />
        ))}
      </div>
    </section>
  );
}
