// HolidayRow — single-line listing for one holiday (FR-3).
//
// Layout mirrors the F06 EventRow:
//   [date col 36px] [3px color bar] [name + note] [type chip] [Plan?]
//
// The optional Plan button only appears when `canPlan` is true. The
// caller (HolidaysPage) sets that based on a server-side role check —
// the button never reaches the HTML for users who shouldn't see it.

import Link from "next/link";
import { Plus } from "lucide-react";
import type { HolidayListItem } from "@/lib/cem/types";
import { parseEventDate } from "@/lib/cem/dates";

type HolidayTypeStyle = {
  label: string;
  text: string;
  bg: string;
  border: string;
};

const HOLIDAY_TYPE_STYLES: Record<HolidayListItem["type"], HolidayTypeStyle> = {
  public: {
    label: "PUBLIC HOLIDAY",
    text: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
  },
  church: {
    label: "CHURCH",
    text: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
  special: {
    label: "SPECIAL",
    text: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
};

export function HolidayRow({
  holiday,
  isLast,
  canPlan,
}: {
  holiday: HolidayListItem;
  isLast: boolean;
  canPlan: boolean;
}) {
  const { dayShort, dayNum } = parseEventDate(holiday.date);
  const style = HOLIDAY_TYPE_STYLES[holiday.type];

  // Plan button targets the request-create flow (F14), pre-filling
  // the date and a suggested title. The route doesn't exist yet —
  // F14 will implement /events/dashboard/admin/new (or similar).
  const planHref = `/events/dashboard/admin/new?date=${encodeURIComponent(holiday.date)}&title=${encodeURIComponent(holiday.name)}`;

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
        style={{ backgroundColor: style.text }}
        aria-hidden="true"
      />

      {/* Name + note */}
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
        <span className="whitespace-nowrap text-[13px] font-medium text-cal-text">
          {holiday.name}
        </span>
        {holiday.note ? (
          <span className="text-[12px] text-cal-text-muted">{holiday.note}</span>
        ) : null}
      </div>

      {/* Type chip */}
      <span
        className="inline-flex shrink-0 items-center whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
        style={{
          color: style.text,
          backgroundColor: style.bg,
          borderColor: style.border,
        }}
      >
        {style.label}
      </span>

      {/* Plan button — admin/superadmin only (server-rendered conditional). */}
      {canPlan ? (
        <Link
          href={planHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-cal-border bg-transparent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-cal-text transition-colors hover:bg-cal-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Plan
        </Link>
      ) : null}
    </div>
  );
}
