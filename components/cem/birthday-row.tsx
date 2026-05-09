// BirthdayRow — single-line listing for one mapped birthday (FR-4).
//
// Layout (matches prototype):
//   [day 36px] [3px color bar] [name + dept] [Landmark tag?] [Today badge?]
//
// SECURITY: This component receives a year-safe `BirthdayListItem`
// (no `year` field on the type). The "Turns {age}" admin-only label
// is rendered from the server-computed `age`, not the year. There is
// no way for a future contributor to accidentally render the year
// because it's never in the props.

import type { BirthdayListItem } from "@/lib/cem/types";

const LANDMARK_COLORS = {
  blue: { text: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  green: { text: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
} as const;

const NEUTRAL_BAR = "var(--cal-bg-emphasis)"; // when no landmark visible

// EC-10: Feb 29 leap-year display.
//
// Someone born on Feb 29 has a birthday that doesn't exist in non-leap
// years. We detect that case and display the day as "28*" (with a
// title attribute explaining the adjustment) so the row appears under
// February without lying about the actual date.
//
// Computed at module-evaluation time. Fine for our deployment cadence;
// if a build straddles a year boundary, the worst case is one day of
// stale rendering until the next deploy.
function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
const CURRENT_YEAR_IS_LEAP = isLeapYear(new Date().getFullYear());

function displayDay(birthday: BirthdayListItem): {
  text: string;
  hint: string | null;
} {
  if (birthday.month === 2 && birthday.day === 29 && !CURRENT_YEAR_IS_LEAP) {
    return {
      text: "28*",
      hint: "Born Feb 29 — shown on Feb 28 in non-leap years.",
    };
  }
  return { text: String(birthday.day), hint: null };
}

export function BirthdayRow({
  birthday,
  isToday,
  isLast,
}: {
  birthday: BirthdayListItem;
  isToday: boolean;
  isLast: boolean;
}) {
  const lc =
    birthday.isLandmark && birthday.landmarkColor
      ? LANDMARK_COLORS[birthday.landmarkColor]
      : null;

  // Tag text (EC-11): use "Turns {age}" instead of "Turns {age}".
  // Year-based calculation means someone born in December already
  // shows the new age in January even though they haven't reached it.
  // "Turns N" reads as "this calendar year" and is accurate without
  // adding date-aware logic.
  //   - Admin viewer: "Turns {age}".
  //   - Non-admin: "Landmark" (no age leak).
  const tagText =
    birthday.age != null ? `Turns ${birthday.age}` : "Landmark";

  return (
    <div
      className={`flex items-center gap-3.5 px-5 py-2 transition-colors ${
        isToday ? "bg-[#fffbeb] dark:bg-[#1c1c1c]" : "hover:bg-cal-bg-subtle"
      } ${isLast ? "" : "border-b border-cal-border"}`}
    >
      {/* Day number — EC-10: Feb 29 → "28*" in non-leap years. */}
      <div className="w-9 shrink-0 text-center">
        {(() => {
          const { text, hint } = displayDay(birthday);
          return (
            <div
              className="font-display text-[20px] font-normal leading-snug text-cal-text"
              title={hint ?? undefined}
            >
              {text}
            </div>
          );
        })()}
      </div>

      {/* 3px color bar — landmark color when tag visible, otherwise neutral */}
      <div
        className="h-5 w-[3px] shrink-0 rounded-sm"
        style={{ backgroundColor: lc ? lc.text : NEUTRAL_BAR }}
        aria-hidden="true"
      />

      {/* Name + department */}
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="whitespace-nowrap text-[13px] font-medium text-cal-text">
          {birthday.name}
        </span>
        {birthday.department_name ? (
          <span className="whitespace-nowrap text-[12px] text-cal-text-muted">
            {birthday.department_name}
          </span>
        ) : null}
      </div>

      {/* Landmark tag */}
      {lc ? (
        <span
          className="inline-flex shrink-0 items-center whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: lc.text, backgroundColor: lc.bg, borderColor: lc.border }}
        >
          {tagText}
        </span>
      ) : null}

      {/* Today badge — amber */}
      {isToday ? (
        <span
          className="inline-flex shrink-0 items-center whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "#854d0e", backgroundColor: "#fffbeb", borderColor: "#fde68a" }}
        >
          Today
        </span>
      ) : null}
    </div>
  );
}

/** Compact variant for the fluid card grid. No department text. */
export function BirthdayRowCompact({ birthday }: { birthday: BirthdayListItem }) {
  const lc =
    birthday.isLandmark && birthday.landmarkColor
      ? LANDMARK_COLORS[birthday.landmarkColor]
      : null;
  const tagText = birthday.age != null ? String(birthday.age) : "LM";

  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <div className="w-7 shrink-0 text-center">
        {(() => {
          const { text, hint } = displayDay(birthday);
          return (
            <div
              className="font-display text-[15px] font-normal leading-tight text-cal-text"
              title={hint ?? undefined}
            >
              {text}
            </div>
          );
        })()}
      </div>
      <div
        className="h-4 w-[2px] shrink-0 rounded-sm"
        style={{ backgroundColor: lc ? lc.text : NEUTRAL_BAR }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-cal-text">
        {birthday.name}
      </span>
      {lc ? (
        <span
          className="inline-flex shrink-0 items-center rounded border px-1.5 text-[9px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: lc.text, backgroundColor: lc.bg, borderColor: lc.border }}
        >
          {tagText}
        </span>
      ) : null}
    </div>
  );
}
