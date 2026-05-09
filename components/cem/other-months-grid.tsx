// OtherMonthsGrid — fluid card grid for non-current months (FR-4):
//   "flex: 1 1 260px, max 340px, min 240px. Wrap based on viewport
//    width. Future months first, then past months at 55% opacity."
//
// Each card is a compact month section: month name + count header,
// then condensed BirthdayRowCompact rows (no department text).

import { BirthdayRowCompact } from "./birthday-row";
import { MONTHS_LONG } from "@/lib/cem/dates";
import type { BirthdayListItem } from "@/lib/cem/types";

type Bucket = {
  monthIndex: number; // 0-11
  birthdays: BirthdayListItem[];
  past: boolean;
};

export function OtherMonthsGrid({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-4">
      {buckets.map((b) => (
        <li
          key={b.monthIndex}
          className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg"
          style={{
            flex: "1 1 260px",
            maxWidth: 340,
            minWidth: 240,
            opacity: b.past ? 0.55 : 1,
          }}
        >
          <div className="flex items-center border-b border-cal-border px-4 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-cal-text-secondary">
              {MONTHS_LONG[b.monthIndex]}
            </span>
            <span
              className="mx-2 text-[11px] font-medium tracking-[0.08em] text-cal-text-muted"
              aria-hidden="true"
            >
              |
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-cal-text-secondary">
              {b.birthdays.length}
            </span>
          </div>
          <ul>
            {b.birthdays.map((bd) => (
              <li key={bd.id}>
                <BirthdayRowCompact birthday={bd} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
