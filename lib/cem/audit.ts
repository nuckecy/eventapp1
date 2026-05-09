// Audit log read layer (F18). Writes are scattered across each state
// transition (F14-F17 + F12). This module is read-only.
//
// SECURITY:
// - All queries are tenant-scoped.
// - The table has no UPDATE/DELETE policy — INSERT and SELECT only —
//   enforced by F03's RLS migration. This module never attempts a
//   write; if it did, RLS would reject it.
// - Caller must verify Super Admin role before invoking listAuditLog.
//   Application-side: page.tsx redirects non-superadmin to /no-access.

import "server-only";

import { and, desc, eq, ilike, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/db";
import { cemAuditLog, coreUsers } from "@/db/schema";

export type AuditFilters = {
  /** Filter by action prefix (e.g. "request" matches "request.submitted"). */
  actionPrefix?: string | null;
  /** Filter by target_type (request | event | birthday). */
  targetType?: string | null;
  /** ISO date string YYYY-MM-DD. Inclusive lower bound. */
  fromDate?: string | null;
  /** ISO date string YYYY-MM-DD. Inclusive upper bound. */
  toDate?: string | null;
};

export type AuditLogRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: string | null;
  created_at: Date | null;
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
};

const MAX_LIMIT = 200;

export async function listAuditLog(
  tenantId: string,
  filters: AuditFilters = {},
  limit = 100,
): Promise<AuditLogRow[]> {
  const safeLimit = Math.min(Math.max(1, limit | 0), MAX_LIMIT);

  const where: SQL[] = [eq(cemAuditLog.tenant_id, tenantId)];

  if (filters.actionPrefix && filters.actionPrefix.length > 0) {
    // Use Drizzle ilike with escaped meta-chars on the prefix; append `%`
    // for prefix matching.
    const escaped = escapeLikeMeta(filters.actionPrefix.slice(0, 64));
    where.push(ilike(cemAuditLog.action, `${escaped}%`));
  }
  if (filters.targetType && filters.targetType.length > 0) {
    where.push(eq(cemAuditLog.target_type, filters.targetType.slice(0, 32)));
  }
  if (filters.fromDate && /^\d{4}-\d{2}-\d{2}$/.test(filters.fromDate)) {
    where.push(gte(cemAuditLog.created_at, new Date(`${filters.fromDate}T00:00:00Z`)));
  }
  if (filters.toDate && /^\d{4}-\d{2}-\d{2}$/.test(filters.toDate)) {
    where.push(lte(cemAuditLog.created_at, new Date(`${filters.toDate}T23:59:59Z`)));
  }

  const rows = await db
    .select({
      id: cemAuditLog.id,
      action: cemAuditLog.action,
      target_type: cemAuditLog.target_type,
      target_id: cemAuditLog.target_id,
      metadata: cemAuditLog.metadata,
      created_at: cemAuditLog.created_at,
      actor_id: cemAuditLog.actor_id,
      actor_name: coreUsers.name,
      actor_email: coreUsers.email,
    })
    .from(cemAuditLog)
    .leftJoin(coreUsers, eq(coreUsers.id, cemAuditLog.actor_id))
    .where(and(...where))
    .orderBy(desc(cemAuditLog.created_at))
    .limit(safeLimit);

  return rows;
}

/** Escape SQL LIKE meta-characters: \, %, _ */
function escapeLikeMeta(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
