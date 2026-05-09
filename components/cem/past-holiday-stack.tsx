"use client";

// PastHolidayStack — collapsible accordion that hides past months by
// default. Mirrors F06's PastStack pattern using the native
// <details>/<summary> primitive for built-in keyboard + screen-reader
// support.

import { ChevronDown } from "lucide-react";
import { HolidayMonthSection } from "./holiday-month-section";
import type { HolidayListItem } from "@/lib/cem/types";

export function PastHolidayStack({
  byMonth,
  canPlan,
}: {
  byMonth: Array<{ monthIndex: number; holidays: HolidayListItem[] }>;
  canPlan: boolean;
}) {
  const monthCount = byMonth.length;
  const dateCount = byMonth.reduce((sum, m) => sum + m.holidays.length, 0);

  return (
    <details className="group">
      <summary className="relative flex w-full cursor-pointer list-none items-center rounded-lg border border-cal-border bg-cal-card-bg px-5 py-3 transition-colors hover:border-cal-bg-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2">
        {/* Stacked-card slabs (collapsed only) */}
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
          {dateCount} {dateCount === 1 ? "DATE" : "DATES"}
        </span>

        <ChevronDown
          className="ml-auto h-4 w-4 text-cal-text-muted transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="mt-5 flex flex-col gap-5">
        {byMonth.map((m) => (
          <HolidayMonthSection
            key={m.monthIndex}
            monthIndex={m.monthIndex}
            holidays={m.holidays}
            muted
            canPlan={canPlan}
          />
        ))}
      </div>
    </details>
  );
}
