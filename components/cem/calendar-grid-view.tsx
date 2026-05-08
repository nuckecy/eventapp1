"use client";

// Calendar grid view (FR-1 calendar view). Combines:
//   - MonthNavBar: prev/month-label/next/today, URL-driven (?month=YYYY-MM)
//   - MonthGrid: 7-col Sun-Sat with day cells + event chips
//   - EventDetailModal: opens when a chip is clicked
//
// Lives in one client component so the modal can hold a ref and the
// chips can call show()/close() without prop-drilling state up to the
// page.
//
// Props:
//   - events: the full filtered event list for the current tenant. We
//     filter to the visible month here. Inexpensive at the prototype
//     scale (25 events) and avoids a second round-trip per month nav.
//   - currentMonth: parsed { year, month } from the ?month= URL param.
//   - todayIso: today's date in YYYY-MM-DD (passed in from the server
//     so SSR matches the client; otherwise hydration would drift).

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { EventDetailModal, type EventDetailModalRef } from "./event-detail-modal";
import type { EventListItem } from "@/lib/cem/types";
import {
  DAYS_SHORT,
  formatMonthLabel,
  formatMonthParam,
  type MonthGridCell,
  monthGridCells,
  nextMonth,
  prevMonth,
  type YearMonth,
} from "@/lib/cem/dates";

const TYPE_HEX: Record<EventListItem["type"], string> = {
  sunday: "#0d9488",
  regional: "#7c3aed",
  local: "#111827",
};

export function CalendarGridView({
  events,
  currentMonth,
  todayIso,
  todayMonth,
}: {
  events: EventListItem[];
  currentMonth: YearMonth;
  todayIso: string;
  todayMonth: YearMonth;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const modalRef = useRef<EventDetailModalRef>(null);
  const [selected, setSelected] = useState<EventListItem | null>(null);

  // Build the cell list once per month.
  const cells = useMemo(() => monthGridCells(currentMonth), [currentMonth]);

  // Bucket events by ISO date for O(1) cell lookups.
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventListItem[]>();
    for (const e of events) {
      const bucket = map.get(e.date);
      if (bucket) bucket.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [events]);

  function hrefFor(target: YearMonth): string {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "calendar");
    // Omit the param when navigating back to "today's month" so the URL
    // stays clean.
    if (target.year === todayMonth.year && target.month === todayMonth.month) {
      p.delete("month");
    } else {
      p.set("month", formatMonthParam(target));
    }
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function openEvent(event: EventListItem) {
    setSelected(event);
    // Wait for the next tick so the modal has the new content before
    // showModal() is called.
    queueMicrotask(() => modalRef.current?.show(event));
  }

  return (
    <>
      {/* ── Month nav bar ───────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Link
            href={hrefFor(prevMonth(currentMonth))}
            aria-label="Previous month"
            scroll={false}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-cal-text-secondary transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="min-w-[140px] text-center font-display text-[15px] font-medium text-cal-text">
            {formatMonthLabel(currentMonth)}
          </span>
          <Link
            href={hrefFor(nextMonth(currentMonth))}
            aria-label="Next month"
            scroll={false}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-cal-text-secondary transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <Link
          href={hrefFor(todayMonth)}
          scroll={false}
          className="inline-flex h-8 items-center rounded-lg border border-cal-border bg-transparent px-3 text-[12px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
        >
          Today
        </Link>
      </div>

      {/* ── Grid ────────────────────────────────────────────────── */}
      <div
        role="grid"
        aria-label={`${formatMonthLabel(currentMonth)} calendar`}
        className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg"
      >
        {/* Day-of-week header row */}
        <div role="row" className="grid grid-cols-7 border-b border-cal-border bg-cal-bg-subtle">
          {DAYS_SHORT.map((d) => (
            <div
              key={d}
              role="columnheader"
              className="px-3 py-3 text-center text-[12px] font-medium uppercase tracking-[0.05em] text-cal-text-secondary"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell) => (
            <DayCell
              key={cell.iso}
              cell={cell}
              isToday={cell.iso === todayIso}
              events={eventsByDate.get(cell.iso) ?? []}
              onSelectEvent={openEvent}
            />
          ))}
        </div>
      </div>

      <EventDetailModal
        ref={modalRef}
        event={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function DayCell({
  cell,
  isToday,
  events,
  onSelectEvent,
}: {
  cell: MonthGridCell;
  isToday: boolean;
  events: EventListItem[];
  onSelectEvent: (e: EventListItem) => void;
}) {
  return (
    <div
      role="gridcell"
      className={`min-h-[90px] border-b border-r border-cal-border p-2 last:border-r-0 ${
        cell.outsideMonth ? "bg-cal-bg-subtle" : ""
      }`}
    >
      <span
        className={`text-[12px] ${
          cell.outsideMonth
            ? "text-cal-text-muted"
            : isToday
              ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-cal-brand text-cal-bg"
              : "font-medium text-cal-text"
        }`}
      >
        {cell.day}
      </span>
      {events.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-1">
          {events.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onSelectEvent(e)}
                className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-1"
                style={{ backgroundColor: TYPE_HEX[e.type] }}
              >
                {e.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
