// Holiday query helpers — F09.
//
// SECURITY:
// - Tenant scoping (PRD Section 16, rule 4): every query filters by
//   `tenant_id`. Drizzle's `eq` is parameter-safe.
// - Public reference data: holidays are not sensitive, so the page is
//   anonymous-friendly. The Plan button (admin-only action) is gated
//   server-side on role; see app/events/holidays/page.tsx.

import "server-only";

import { and, asc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { cemHolidays } from "@/db/schema";
import { HOLIDAY_TYPES, type HolidayListItem, type HolidayType } from "./types";

export type HolidayFilters = {
  /** Set of types to include. Empty set returns no rows (UI default: all on). */
  types?: ReadonlySet<HolidayType>;
};

/**
 * List holidays for a tenant, ordered by date ascending. Optional
 * type filter narrows to a subset.
 */
export async function listHolidays(
  tenantId: string,
  filters: HolidayFilters = {},
): Promise<HolidayListItem[]> {
  const conditions = [eq(cemHolidays.tenant_id, tenantId)];

  if (filters.types) {
    const arr = Array.from(filters.types);
    if (arr.length === 0) return [];
    if (arr.length < HOLIDAY_TYPES.length) {
      const typeConditions = arr.map((t) => eq(cemHolidays.type, t));
      const combined =
        typeConditions.length === 1 ? typeConditions[0] : or(...typeConditions);
      if (combined) conditions.push(combined);
    }
  }

  const rows = await db
    .select({
      id: cemHolidays.id,
      date: cemHolidays.date,
      name: cemHolidays.name,
      type: cemHolidays.type,
      note: cemHolidays.note,
      year: cemHolidays.year,
    })
    .from(cemHolidays)
    .where(and(...conditions))
    .orderBy(asc(cemHolidays.date));

  return rows.map((r) => ({
    ...r,
    type: r.type as HolidayType,
  }));
}
