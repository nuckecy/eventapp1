// EmptyState — used when a filtered list returns no items.
// PRD Section 7.2: "No events matching '{query}'" with query echoed,
// or generic "No events yet" if no filters are active.
//
// Note: PRD says "Use --cal-text-muted for empty state text. Never
// brand color." We honour that.
//
// Generic over the noun (events / holidays / …) so the same component
// can be reused across list pages without forking copy.

import { CalendarDays } from "lucide-react";

type Variant = "no-events" | "no-results";

const COPY: Record<
  string,
  {
    nothingHeading: string;
    nothingBody: string;
    filteredHeading: string;
    filteredBody: (query?: string) => string;
  }
> = {
  events: {
    nothingHeading: "No events yet",
    nothingBody: "Events will appear here once they are created and approved.",
    filteredHeading: "No events found",
    filteredBody: (q) =>
      q
        ? `No events matching "${q}". Try adjusting your filters.`
        : "Try adjusting your filters or search terms.",
  },
  holidays: {
    nothingHeading: "No holidays",
    nothingBody: "Holidays will appear here once they are added.",
    filteredHeading: "No holidays match",
    filteredBody: () => "Toggle the filters above to show holiday types.",
  },
};

export function EmptyState({
  variant,
  query,
  noun = "events",
}: {
  variant: Variant;
  query?: string;
  /** Used to pick the right copy (events / holidays / …). Defaults to "events". */
  noun?: keyof typeof COPY;
}) {
  const copy = COPY[noun] ?? COPY.events;
  return (
    <div className="rounded-lg border border-cal-border bg-cal-card-bg px-6 py-16 text-center">
      <CalendarDays
        className="mx-auto h-10 w-10 text-cal-text-muted"
        aria-hidden="true"
      />
      <h3 className="mt-4 font-display text-[16px] font-medium text-cal-text">
        {variant === "no-events" ? copy.nothingHeading : copy.filteredHeading}
      </h3>
      <p className="mt-2 text-[13px] text-cal-text-muted">
        {variant === "no-events" ? copy.nothingBody : copy.filteredBody(query)}
      </p>
    </div>
  );
}
