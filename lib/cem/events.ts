// Event query helpers for the Calendar.
//
// SECURITY (PRD Section 16):
// - Rule 4 (tenant isolation): every query includes WHERE tenant_id = ?.
//   Callers obtain `tenantId` from the middleware-injected header via
//   `getCurrentTenantId()` below — never from request body or client.
// - Rule 2 (parameterized queries): we use Drizzle's `eq` and `ilike`
//   helpers, both parameter-safe. No string interpolation into SQL.
// - The search term length is capped at 200 characters to bound query
//   cost (defense against pathological inputs).

import "server-only";

import { headers } from "next/headers";
import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  cemDepartments,
  cemEvents,
  coreTenants,
} from "@/db/schema";
import { readTenantContextFromHeaders } from "@/lib/tenant";
import { EVENT_TYPES, type EventListItem, type EventType } from "./types";

// Re-export the shared types + constant for legacy callers.
export { EVENT_TYPES };
export type { EventListItem, EventType };

const SEARCH_MAX_LENGTH = 200;

export type EventListFilters = {
  /** Set of types to include. Empty set returns no events (UI default: all on). */
  types?: ReadonlySet<EventType>;
  /** Department ID to filter by, or null for all. */
  departmentId?: string | null;
  /** Case-insensitive substring match against `title`. Trimmed + length-capped. */
  search?: string | null;
};

// ── Tenant resolution ────────────────────────────────────────────────
//
// In production, the F02 middleware sets `x-tenant-id` on every
// in-tenant request. In dev (when visiting `localhost:3000` directly,
// no subdomain) we fall back to the single seeded tenant if there's
// exactly one. Never silently expose data across tenants in
// production.

export async function getCurrentTenantId(): Promise<string | null> {
  const requestHeaders = await headers();
  const ctx = readTenantContextFromHeaders(requestHeaders);
  if (ctx) return ctx.tenantId;

  // Dev fallback: only used when no tenant header is set (i.e.
  // localhost). If there's exactly one active tenant in the database,
  // use it. If there's more than one, refuse — the caller must use a
  // subdomain.
  if (process.env.NODE_ENV === "production") return null;
  const tenants = await db
    .select({ id: coreTenants.id })
    .from(coreTenants)
    .where(eq(coreTenants.status, "active"))
    .limit(2);
  if (tenants.length === 1) return tenants[0].id;
  return null;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * List published events for a tenant, with optional filters.
 *
 * Returned in chronological order so the caller can group by month.
 */
export async function listEvents(
  tenantId: string,
  filters: EventListFilters = {},
): Promise<EventListItem[]> {
  const conditions = [
    eq(cemEvents.tenant_id, tenantId),
    // EC-06: hide soft-deleted events.
    isNull(cemEvents.deleted_at),
  ];

  // Type filter — translate the Set to an OR clause. An empty set
  // returns no rows (caller should normally pass undefined for "all").
  if (filters.types) {
    const arr = Array.from(filters.types);
    if (arr.length === 0) return [];
    if (arr.length < EVENT_TYPES.length) {
      // Only add the OR if it actually filters something out.
      const typeConditions = arr.map((t) => eq(cemEvents.type, t));
      const combined =
        typeConditions.length === 1 ? typeConditions[0] : or(...typeConditions);
      if (combined) conditions.push(combined);
    }
  }

  // Department filter.
  if (filters.departmentId) {
    conditions.push(eq(cemEvents.department_id, filters.departmentId));
  }

  // Search filter. Trim + cap length to bound query cost. Drizzle's
  // `ilike` is parameter-safe; we still escape SQL LIKE meta-chars
  // (% and _) so they don't act as wildcards.
  if (filters.search) {
    const trimmed = filters.search.trim().slice(0, SEARCH_MAX_LENGTH);
    if (trimmed.length > 0) {
      const escaped = trimmed.replace(/[\\%_]/g, (c) => `\\${c}`);
      conditions.push(ilike(cemEvents.title, `%${escaped}%`));
    }
  }

  const rows = await db
    .select({
      id: cemEvents.id,
      title: cemEvents.title,
      type: cemEvents.type,
      date: cemEvents.date,
      time: cemEvents.time,
      location: cemEvents.location,
      description: cemEvents.description,
      expected_attendance: cemEvents.expected_attendance,
      department_id: cemEvents.department_id,
      department_name: cemDepartments.name,
      // EC-07: cancellation flag — calendar styles cancelled events
      // with strikethrough + a red badge, but still shows them.
      cancelled_at: cemEvents.cancelled_at,
      cancellation_reason: cemEvents.cancellation_reason,
    })
    .from(cemEvents)
    .leftJoin(cemDepartments, eq(cemDepartments.id, cemEvents.department_id))
    .where(and(...conditions))
    .orderBy(asc(cemEvents.date), asc(cemEvents.time));

  return rows.map((r) => ({
    ...r,
    type: r.type as EventType,
  }));
}

/**
 * List the tenant's departments, ordered by name. Used to populate
 * the Departments dropdown in the calendar's filter bar. Public —
 * names only, no contact details.
 */
export async function listDepartmentNames(
  tenantId: string,
): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: cemDepartments.id, name: cemDepartments.name })
    .from(cemDepartments)
    // EC-06: hide soft-deleted departments.
    .where(
      and(
        eq(cemDepartments.tenant_id, tenantId),
        isNull(cemDepartments.deleted_at),
      ),
    )
    .orderBy(asc(cemDepartments.name));
}
