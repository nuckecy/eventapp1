"use client";

// PastStack — collapsible accordion that hides past months by default
// per FR-1. Uses native <details>/<summary> for built-in keyboard +
// screen-reader behavior (Enter/Space to toggle, exposed as a
// disclosure widget). The "stacked card" visual effect comes from two
// absolutely-positioned ghost slabs behind the summary that disappear
// when expanded.

import { ChevronDown } from "lucide-react";
import { MonthSection } from "./month-section";
import type { EventListItem } from "@/lib/cem/types";

export function PastStack({
  byMonth,
}: {
  byMonth: Array<{ monthIndex: number; events: EventListItem[] }>;
}) {
  const monthCount = byMonth.length;
  const eventCount = byMonth.reduce((sum, m) => sum + m.events.length, 0);

  return (
    <details className="group">
      <summary className="relative flex w-full cursor-pointer list-none items-center rounded-lg border border-cal-border bg-cal-card-bg px-5 py-3 transition-colors hover:border-cal-bg-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2">
        {/* Stacked-card slabs (collapsed state only) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1 left-1 right-1 -z-10 h-2 rounded-b-md border border-t-0 border-cal-border bg-cal-bg-subtle group-open:hidden"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-2 left-2 right-2 -z-20 h-1.5 rounded-b-md border border-t-0 border-cal-border bg-cal-bg-muted group-open:hidden"
        />

        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-cal-text-muted">
          {monthCount} {monthCount === 1 ? "PAST MONTH" : "PAST MONTHS"}
        </span>
        <span
          aria-hidden="true"
          className="mx-2 text-[11px] font-medium tracking-[0.08em] text-cal-text-muted"
        >
          |
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-cal-text-muted">
          {eventCount} {eventCount === 1 ? "EVENT" : "EVENTS"}
        </span>

        <ChevronDown
          className="ml-auto h-4 w-4 text-cal-text-muted transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="mt-5 flex flex-col gap-5">
        {byMonth.map((m) => (
          <MonthSection
            key={m.monthIndex}
            monthIndex={m.monthIndex}
            events={m.events}
            muted
          />
        ))}
      </div>
    </details>
  );
}
