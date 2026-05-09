// Audit Log viewer (F18). Super Admin only.
//
// SECURITY:
// - Role check via requireAuth() + manual role narrowing. Non-super
//   redirects to /no-access.
// - All filters arrive in the URL search params (so filters are
//   shareable + back-button works) but are validated/sanitized in the
//   audit data layer before reaching the database.
// - The cem_audit_log table is INSERT-only at the DB level (F03 RLS).
//   This viewer is purely read.

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listAuditLog, type AuditFilters } from "@/lib/cem/audit";
import { AuditLogClient } from "./AuditLogClient";

export const dynamic = "force-dynamic";

type Search = {
  action?: string;
  target?: string;
  from?: string;
  to?: string;
  /** EC-12: page size; clamped 1-1000. Default 50. */
  limit?: string;
};

const ALLOWED_TARGETS = new Set(["request", "event", "birthday"]);
const ALLOWED_ACTION_PREFIXES = new Set([
  "request",
  "birthday",
  "event",
  "request.submitted",
  "request.claimed",
  "request.unclaimed",
  "request.reassigned",
  "request.timed_out",
  "request.forwarded",
  "request.returned",
  "request.approved",
  "request.sent_back",
  "request.deleted",
  "request.cancelled",
  "request.recalled",
  "request.draft_created",
  "request.draft_updated",
]);

export default async function AuditLogPage(props: {
  searchParams: Promise<Search>;
}) {
  const session = await requireAuth();
  if (session.role !== "superadmin" && session.role !== "platform_admin") {
    redirect("/no-access");
  }

  const sp = await props.searchParams;

  const filters: AuditFilters = {
    actionPrefix:
      sp.action && ALLOWED_ACTION_PREFIXES.has(sp.action) ? sp.action : null,
    targetType: sp.target && ALLOWED_TARGETS.has(sp.target) ? sp.target : null,
    fromDate: sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : null,
    toDate: sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : null,
  };

  // EC-12: parse and clamp ?limit=. Hard-cap at 1000.
  const requestedLimit = sp.limit ? Number.parseInt(sp.limit, 10) : 50;
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit >= 1
      ? Math.min(requestedLimit, 1000)
      : 50;

  const rows = await listAuditLog(session.tenantId, filters, limit);

  return (
    <AuditLogClient
      rows={rows.map((r) => ({
        ...r,
        created_at: r.created_at ?? new Date(),
      }))}
      filters={filters}
      currentLimit={limit}
    />
  );
}
