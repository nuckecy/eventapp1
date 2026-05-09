// BirthdayRow — single-line listing for one mapped birthday (FR-4).
//
// Layout (matches prototype):
//   [day 36px] [3px color bar] [name + dept] [Landmark tag?] [Today badge?]
//
// SECURITY: This component receives a year-safe `BirthdayListItem`
// (no `year` field on the type). The "Turning {age}" admin-only label
// is rendered from the server-computed `age`, not the year. There is
// no way for a future contributor to accidentally render the year
// because it's never in the props.

import type { BirthdayListItem } from "@/lib/cem/types";

const LANDMARK_COLORS = {
  blue: { text: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  green: { text: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
} as const;

const NEUTRAL_BAR = "var(--cal-bg-emphasis)"; // when no landmark visible

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

  // Tag text:
  //   - Admin viewer: "Turning {age}" (age is set server-side only
  //     for admin viewers; null for everyone else, in which case we
  //     fall back to "Landmark").
  //   - Non-admin: always "Landmark" (no age).
  const tagText =
    birthday.age != null ? `Turning ${birthday.age}` : "Landmark";

  return (
    <div
      className={`flex items-center gap-3.5 px-5 py-2 transition-colors ${
        isToday ? "bg-[#fffbeb] dark:bg-[#1c1c1c]" : "hover:bg-cal-bg-subtle"
      } ${isLast ? "" : "border-b border-cal-border"}`}
    >
      {/* Day number */}
      <div className="w-9 shrink-0 text-center">
        <div className="font-display text-[20px] font-normal leading-snug text-cal-text">
          {birthday.day}
        </div>
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
        <div className="font-display text-[15px] font-normal leading-tight text-cal-text">
          {birthday.day}
        </div>
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
