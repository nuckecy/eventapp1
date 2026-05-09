// Holidays page (FR-3).
//
// Public — anyone can browse Berlin 2026 holidays + church calendar +
// special days. Three type chips toggle visibility per type. Past
// months collapse into a stack accordion (60% opacity when expanded).
//
// "Plan" button (admin / superadmin only): per FR-3, gives staff a
// quick way to create a request prefilled with a holiday's date and
// suggested title. We render the button conditionally based on a
// SERVER-SIDE role check via getSession() — anonymous users and
// member/lead roles never receive the button in their HTML.
//
// SECURITY (F09 checkpoint):
//   "Plan button rendering is role-checked server-side. Client-side
//    role hiding is cosmetic only; endpoint must verify role."
// We satisfy the rendering side here; the endpoint check lives with
// F14 (request creation).

import { EmptyState } from "@/components/cem/empty-state";
import { HolidayMonthSection } from "@/components/cem/holiday-month-section";
import { HolidayTypeFilterBar } from "@/components/cem/holiday-type-filter-bar";
import { PastHolidayStack } from "@/components/cem/past-holiday-stack";
import { parseEventDate, todayLocalISO } from "@/lib/cem/dates";
import { getSession } from "@/lib/auth/session";
import {
  HOLIDAY_TYPES,
  type HolidayListItem,
  type HolidayType,
} from "@/lib/cem/types";
import { listHolidays } from "@/lib/cem/holidays";
import { getCurrentTenantId } from "@/lib/cem/events";

export const metadata = { title: "Holidays · Church Event Management" };

type SearchParams = Promise<{ type?: string }>;

function parseTypeParam(raw: string | undefined): Set<HolidayType> | undefined {
  if (raw === undefined) return undefined; // all on
  if (raw === "") return new Set(); // all off
  const requested = raw
    .split(",")
    .filter((t): t is HolidayType => (HOLIDAY_TYPES as readonly string[]).includes(t));
  return new Set(requested);
}

function groupByMonth(holidays: HolidayListItem[]): Map<number, HolidayListItem[]> {
  const map = new Map<number, HolidayListItem[]>();
  for (const h of holidays) {
    const { month } = parseEventDate(h.date);
    const bucket = map.get(month);
    if (bucket) bucket.push(h);
    else map.set(month, [h]);
  }
  return map;
}

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tenantId = await getCurrentTenantId();

  if (!tenantId) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <h1 className="font-display text-[28px] font-medium">Holidays</h1>
        <p className="mt-3 text-[13px] text-cal-text-secondary">
          No tenant context. Visit via a tenant subdomain.
        </p>
      </div>
    );
  }

  // SERVER-SIDE role check for the Plan button. Anonymous users and
  // members/leads never get this prop set to true.
  const session = await getSession();
  const canPlan =
    session !== null &&
    (session.role === "admin" ||
      session.role === "superadmin" ||
      session.role === "platform_admin");

  const holidays = await listHolidays(tenantId, {
    types: parseTypeParam(params.type),
  });

  const today = todayLocalISO();
  const past: HolidayListItem[] = [];
  const upcoming: HolidayListItem[] = [];
  for (const h of holidays) {
    if (h.date < today) past.push(h);
    else upcoming.push(h);
  }

  const pastByMonth = groupByMonth(past);
  const upcomingByMonth = groupByMonth(upcoming);

  const hasFilters =
    params.type !== undefined &&
    parseTypeParam(params.type)?.size !== HOLIDAY_TYPES.length;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <header className="mb-8 max-w-[520px]">
        <h1 className="font-display text-[28px] font-medium leading-tight">
          Holidays &amp; Special Days
        </h1>
        <p className="mt-2 text-[13px] text-cal-text-secondary">
          Berlin public holidays, church calendar, and special occasions for 2026.
          {canPlan ? " Use the Plan button to create an event around any date." : ""}
        </p>
      </header>

      <div className="mb-7">
        <HolidayTypeFilterBar />
      </div>

      {holidays.length === 0 ? (
        <EmptyState
          variant={hasFilters ? "no-results" : "no-events"}
          noun="holidays"
        />
      ) : (
        <div className="flex flex-col gap-6">
          {pastByMonth.size > 0 ? (
            <PastHolidayStack
              byMonth={Array.from(pastByMonth.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([monthIndex, holidays]) => ({ monthIndex, holidays }))}
              canPlan={canPlan}
            />
          ) : null}

          {Array.from(upcomingByMonth.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([monthIndex, hs]) => (
              <HolidayMonthSection
                key={monthIndex}
                monthIndex={monthIndex}
                holidays={hs}
                canPlan={canPlan}
              />
            ))}
        </div>
      )}
    </div>
  );
}
