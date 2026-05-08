// EmptyState — used when filters return no events.
// PRD Section 7.2: "No events matching '{query}'" with query echoed,
// or generic "No events yet" if no filters are active.
//
// Note: PRD says "Use --cal-text-muted for empty state text. Never
// brand color." We honour that.

import { CalendarDays } from "lucide-react";

export function EmptyState({
  variant,
  query,
}: {
  variant: "no-events" | "no-results";
  query?: string;
}) {
  return (
    <div className="rounded-lg border border-cal-border bg-cal-card-bg px-6 py-16 text-center">
      <CalendarDays
        className="mx-auto h-10 w-10 text-cal-text-muted"
        aria-hidden="true"
      />
      <h3 className="mt-4 font-display text-[16px] font-medium text-cal-text">
        {variant === "no-events" ? "No events yet" : "No events found"}
      </h3>
      <p className="mt-2 text-[13px] text-cal-text-muted">
        {variant === "no-events"
          ? "Events will appear here once they are created and approved."
          : query
            ? `No events matching "${query}". Try adjusting your filters.`
            : "Try adjusting your filters or search terms."}
      </p>
    </div>
  );
}
