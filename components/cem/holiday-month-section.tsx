// HolidayMonthSection — header + bordered card of HolidayRows.
//
// Header format per FR-3:
//   `MONTH | N DATES`  (uppercase, 11px, weight 500, pipe separator,
//                       --cal-text-secondary color)
//
// Past months render at 60% opacity (parity with F06).

import { HolidayRow } from "./holiday-row";
import type { HolidayListItem } from "@/lib/cem/types";
import { MONTHS_LONG } from "@/lib/cem/dates";

export function HolidayMonthSection({
  monthIndex,
  holidays,
  muted = false,
  canPlan,
}: {
  monthIndex: number; // 0-11
  holidays: HolidayListItem[];
  muted?: boolean;
  canPlan: boolean;
}) {
  const monthName = MONTHS_LONG[monthIndex];
  const count = holidays.length;
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
          {count} {count === 1 ? "DATE" : "DATES"}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg">
        {holidays.map((h, i) => (
          <HolidayRow
            key={h.id}
            holiday={h}
            isLast={i === holidays.length - 1}
            canPlan={!muted && canPlan}
          />
        ))}
      </div>
    </section>
  );
}
