// Current-month section — full-width with "THIS MONTH" amber badge.
// Uses the rich BirthdayRow (with department + landmark + today).

import { BirthdayRow } from "./birthday-row";
import { MONTHS_LONG } from "@/lib/cem/dates";
import type { BirthdayListItem } from "@/lib/cem/types";

export function CurrentMonthSection({
  monthIndex,
  birthdays,
  todayDay,
}: {
  monthIndex: number; // 0-11
  birthdays: BirthdayListItem[];
  todayDay: number;
}) {
  const count = birthdays.length;
  return (
    <section>
      <div className="mb-2 flex items-center px-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-cal-text">
          {MONTHS_LONG[monthIndex]}
        </span>
        <span
          className="mx-2 text-[11px] font-medium tracking-[0.08em] text-cal-text-muted"
          aria-hidden="true"
        >
          |
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-cal-text">
          {count} {count === 1 ? "BIRTHDAY" : "BIRTHDAYS"}
        </span>
        <span
          className="ml-2 inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "#d97706", backgroundColor: "#fffbeb", borderColor: "#fde68a" }}
        >
          THIS MONTH
        </span>
      </div>
      {count === 0 ? (
        <div className="rounded-lg border border-cal-border bg-cal-card-bg px-6 py-6 text-center text-[13px] text-cal-text-muted">
          No birthdays this month
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg">
          {birthdays.map((b, i) => (
            <BirthdayRow
              key={b.id}
              birthday={b}
              isToday={b.day === todayDay}
              isLast={i === birthdays.length - 1}
            />
          ))}
        </div>
      )}
    </section>
  );
}
