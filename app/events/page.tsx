// Calendar — public landing page (FR-1).
//
// Two top-level views toggled by the pill in the filter card:
//   ?view=list      (default — full-year chronological list)
//   ?view=calendar  (month grid; lands in F07)
//
// Filters (all preserved across view switches):
//   ?q=<text>           case-insensitive search on event title
//   ?type=a,b,c         comma-separated whitelist of event types
//   ?dept=<UUID>        department filter
//
// SECURITY:
// - All filter parsing is server-side; the underlying query in
//   lib/cem/events.ts is parameterized via Drizzle and tenant-scoped
//   (see SECURITY_TEST_REPORT.md F06 section).
// - Public page → no auth required. Read-only access to published
//   events (cem_events.* — no draft/private rows; those live in
//   cem_requests).

import { ViewToggle } from "@/components/cem/view-toggle";
import { FilterBar } from "@/components/cem/filter-bar";
import { MonthSection } from "@/components/cem/month-section";
import { PastStack } from "@/components/cem/past-stack";
import { EmptyState } from "@/components/cem/empty-state";
import { CalendarGridView } from "@/components/cem/calendar-grid-view";
import {
  EVENT_TYPES,
  type EventListItem,
  type EventType,
  getCurrentTenantId,
  listDepartmentNames,
  listEvents,
} from "@/lib/cem/events";
import {
  parseEventDate,
  parseMonthParam,
  thisMonth,
  todayLocalISO,
} from "@/lib/cem/dates";

export const metadata = { title: "Calendar · Church Event Management" };

type SearchParams = Promise<{
  view?: string;
  q?: string;
  type?: string;
  dept?: string;
  month?: string; // YYYY-MM, only used when view=calendar
}>;

// ── Helpers ─────────────────────────────────────────────────────────

function parseTypeParam(raw: string | undefined): Set<EventType> | undefined {
  if (raw === undefined) return undefined; // all on
  if (raw === "") return new Set(); // explicitly all off
  const requested = raw
    .split(",")
    .filter((t): t is EventType => (EVENT_TYPES as readonly string[]).includes(t));
  return new Set(requested);
}

function groupByMonth(events: EventListItem[]): Map<number, EventListItem[]> {
  const map = new Map<number, EventListItem[]>();
  for (const e of events) {
    const { month } = parseEventDate(e.date);
    const bucket = map.get(month);
    if (bucket) bucket.push(e);
    else map.set(month, [e]);
  }
  return map;
}

// ── Page ────────────────────────────────────────────────────────────

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const view = params.view === "calendar" ? "calendar" : "list";

  const tenantId = await getCurrentTenantId();

  // No tenant resolvable (production with bad subdomain). Render an
  // empty calendar shell rather than crashing — middleware will have
  // already redirected for genuinely unknown hosts.
  if (!tenantId) {
    return <CalendarShell view={view} departments={[]}><NoTenantPlaceholder /></CalendarShell>;
  }

  const [events, departments] = await Promise.all([
    listEvents(tenantId, {
      types: parseTypeParam(params.type),
      departmentId: params.dept ?? null,
      search: params.q ?? null,
    }),
    listDepartmentNames(tenantId),
  ]);

  if (view === "calendar") {
    const today = todayLocalISO();
    const todayYM = thisMonth();
    const monthYM = parseMonthParam(params.month) ?? todayYM;
    return (
      <CalendarShell view={view} departments={departments}>
        <CalendarGridView
          events={events}
          currentMonth={monthYM}
          todayIso={today}
          todayMonth={todayYM}
        />
      </CalendarShell>
    );
  }

  // ── List view ────────────────────────────────────────────────────
  const today = todayLocalISO();
  const pastEvents: EventListItem[] = [];
  const upcomingEvents: EventListItem[] = [];
  for (const e of events) {
    if (e.date < today) pastEvents.push(e);
    else upcomingEvents.push(e);
  }

  const pastByMonth = groupByMonth(pastEvents);
  const upcomingByMonth = groupByMonth(upcomingEvents);

  const hasAnyEvents = events.length > 0;
  const hasFilters = !!(
    params.q ||
    params.dept ||
    (params.type !== undefined && parseTypeParam(params.type)?.size !== EVENT_TYPES.length)
  );

  return (
    <CalendarShell view="list" departments={departments}>
      {!hasAnyEvents ? (
        <EmptyState
          variant={hasFilters ? "no-results" : "no-events"}
          query={params.q ?? undefined}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {pastByMonth.size > 0 ? (
            <PastStack
              byMonth={Array.from(pastByMonth.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([monthIndex, events]) => ({ monthIndex, events }))}
            />
          ) : null}

          {Array.from(upcomingByMonth.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([monthIndex, events]) => (
              <MonthSection
                key={monthIndex}
                monthIndex={monthIndex}
                events={events}
              />
            ))}
        </div>
      )}
    </CalendarShell>
  );
}

// ── Shell + sub-components ──────────────────────────────────────────

function CalendarShell({
  view,
  departments,
  children,
}: {
  view: "list" | "calendar";
  departments: Array<{ id: string; name: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <header className="mb-8">
        <h1 className="font-display text-[28px] font-medium leading-tight">
          Event Calendar
        </h1>
        <p className="mt-1 text-[13px] text-cal-text-secondary">
          Browse upcoming church events and activities
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-cal-border bg-cal-card-bg px-5 py-3.5">
        <ViewToggle />
        {view === "list" ? (
          <span className="font-display text-[15px] font-medium text-cal-text-secondary">
            2026
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <FilterBar departments={departments} />
        </div>
      </div>

      {children}
    </div>
  );
}

function NoTenantPlaceholder() {
  return (
    <div className="rounded-lg border border-cal-border bg-cal-card-bg px-6 py-12 text-center text-[13px] text-cal-text-secondary">
      No tenant context. Visit the app via a tenant subdomain (e.g.{" "}
      <code className="font-mono text-cal-text">newsong.churchplatform.com</code>) or seed
      a single tenant in the database.
    </div>
  );
}
