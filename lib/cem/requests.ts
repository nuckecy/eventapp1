// Event-request data layer (F14-F16). All queries are tenant-scoped.
//
// SECURITY:
// - Tenant scoping unconditional.
// - Role-specific filtering applied at the helper level: a Lead's
//   listOwnRequests is scoped to (tenantId, leadUserId); admin /
//   super views see all in-tenant. Callers verify role before
//   invoking the appropriate helper.
// - Status transitions are enforced server-side (claim, forward,
//   return, approve etc.). Each transition writes a cem_audit_log
//   entry, supporting F18.

import "server-only";

import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  cemAuditLog,
  cemDepartments,
  cemEvents,
  cemRequestFeedback,
  cemRequests,
} from "@/db/schema";
import { createNotification, getUsersByRoles } from "./notifications";
import type {
  EventRequestType,
  RequestListItem,
  RequestStatus,
} from "./types";

export type { EventRequestType, RequestListItem, RequestStatus } from "./types";
export { STATUS_STYLES } from "./types";

const SELECT_REQUEST = {
  id: cemRequests.id,
  title: cemRequests.title,
  type: cemRequests.type,
  status: cemRequests.status,
  date: cemRequests.date,
  time: cemRequests.time,
  location: cemRequests.location,
  description: cemRequests.description,
  expected_attendance: cemRequests.expected_attendance,
  budget: cemRequests.budget,
  department_id: cemRequests.department_id,
  department_name: cemDepartments.name,
  submitted_by: cemRequests.submitted_by,
  claimed_by: cemRequests.claimed_by,
  approved_by: cemRequests.approved_by,
  submitted_at: cemRequests.submitted_at,
  claimed_at: cemRequests.claimed_at,
  forwarded_at: cemRequests.forwarded_at,
  approved_at: cemRequests.approved_at,
  created_at: cemRequests.created_at,
} as const;

function castRow<T extends { type: string; status: string | null }>(r: T) {
  return {
    ...r,
    type: r.type as EventRequestType,
    status: (r.status ?? "draft") as RequestStatus,
  };
}

/** Lead view: only the user's own requests. */
export async function listOwnRequests(
  tenantId: string,
  userId: string,
): Promise<RequestListItem[]> {
  const rows = await db
    .select(SELECT_REQUEST)
    .from(cemRequests)
    .leftJoin(cemDepartments, eq(cemDepartments.id, cemRequests.department_id))
    .where(
      and(eq(cemRequests.tenant_id, tenantId), eq(cemRequests.submitted_by, userId)),
    )
    .orderBy(desc(cemRequests.created_at));
  return rows.map(castRow);
}

/** Admin/Super view: all requests in the tenant. */
export async function listAllRequests(tenantId: string): Promise<RequestListItem[]> {
  const rows = await db
    .select(SELECT_REQUEST)
    .from(cemRequests)
    .leftJoin(cemDepartments, eq(cemDepartments.id, cemRequests.department_id))
    .where(eq(cemRequests.tenant_id, tenantId))
    .orderBy(desc(cemRequests.created_at));
  return rows.map(castRow);
}

export async function getRequestById(
  tenantId: string,
  requestId: string,
): Promise<RequestListItem | null> {
  const rows = await db
    .select(SELECT_REQUEST)
    .from(cemRequests)
    .leftJoin(cemDepartments, eq(cemDepartments.id, cemRequests.department_id))
    .where(and(eq(cemRequests.id, requestId), eq(cemRequests.tenant_id, tenantId)))
    .limit(1);
  if (rows.length === 0) return null;
  return castRow(rows[0]);
}

// ── Counts for StatsRow ─────────────────────────────────────────────

export async function leadStats(tenantId: string, userId: string) {
  const grouped = await db
    .select({ status: cemRequests.status, n: count() })
    .from(cemRequests)
    .where(
      and(eq(cemRequests.tenant_id, tenantId), eq(cemRequests.submitted_by, userId)),
    )
    .groupBy(cemRequests.status);

  const by: Record<string, number> = {};
  for (const r of grouped) by[r.status ?? "draft"] = Number(r.n);
  const total = Object.values(by).reduce((s, n) => s + n, 0);
  return {
    total,
    drafts: by.draft ?? 0,
    submitted: by.submitted ?? 0,
    pending: (by.submitted ?? 0) + (by.under_review ?? 0) + (by.ready_for_approval ?? 0),
    approved: by.approved ?? 0,
    returned: by.returned ?? 0,
  };
}

export async function adminStats(tenantId: string) {
  const grouped = await db
    .select({ status: cemRequests.status, n: count() })
    .from(cemRequests)
    .where(eq(cemRequests.tenant_id, tenantId))
    .groupBy(cemRequests.status);
  const by: Record<string, number> = {};
  for (const r of grouped) by[r.status ?? "draft"] = Number(r.n);
  return {
    submitted: by.submitted ?? 0,
    underReview: by.under_review ?? 0,
    forwarded: by.ready_for_approval ?? 0,
    returned: by.returned ?? 0,
    totalPending: (by.submitted ?? 0) + (by.under_review ?? 0),
  };
}

export async function superAdminStats(tenantId: string) {
  const grouped = await db
    .select({ status: cemRequests.status, n: count() })
    .from(cemRequests)
    .where(eq(cemRequests.tenant_id, tenantId))
    .groupBy(cemRequests.status);
  const by: Record<string, number> = {};
  for (const r of grouped) by[r.status ?? "draft"] = Number(r.n);
  return {
    forwarded: by.ready_for_approval ?? 0,
    approved: by.approved ?? 0,
    returned: by.returned ?? 0,
    totalRequests: Object.values(by).reduce((s, n) => s + n, 0),
  };
}

// ── State transitions ──────────────────────────────────────────────
// Each writes a cem_audit_log entry. The transitions are validated:
// you can only do X→Y, never skip steps.

export type CreateRequestInput = {
  title: string;
  type: EventRequestType;
  department_id: string;
  date: string | null; // YYYY-MM-DD
  time: string | null;
  location: string | null;
  description: string | null;
  expected_attendance: number | null;
  budget: number | null;
};

export async function createRequestDraft(
  tenantId: string,
  leadUserId: string,
  input: CreateRequestInput,
): Promise<string> {
  const now = new Date();
  const inserted = await db
    .insert(cemRequests)
    .values({
      tenant_id: tenantId,
      title: input.title,
      type: input.type,
      department_id: input.department_id,
      date: input.date,
      time: input.time,
      location: input.location,
      description: input.description,
      expected_attendance: input.expected_attendance,
      budget: input.budget,
      status: "draft",
      submitted_by: leadUserId,
      created_at: now,
      updated_at: now,
    })
    .returning({ id: cemRequests.id });
  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: leadUserId,
    action: "request.draft_created",
    target_type: "request",
    target_id: inserted[0].id,
    metadata: JSON.stringify({ title: input.title }),
  });
  return inserted[0].id;
}

export async function updateRequestDraft(
  tenantId: string,
  leadUserId: string,
  requestId: string,
  input: CreateRequestInput,
): Promise<void> {
  const existing = await db
    .select({
      id: cemRequests.id,
      status: cemRequests.status,
      submitted_by: cemRequests.submitted_by,
    })
    .from(cemRequests)
    .where(and(eq(cemRequests.id, requestId), eq(cemRequests.tenant_id, tenantId)))
    .limit(1);
  if (existing.length === 0) throw new Error("not_found");
  if (existing[0].status !== "draft") throw new Error("not_draft");
  if (existing[0].submitted_by !== leadUserId) throw new Error("not_owner");

  await db
    .update(cemRequests)
    .set({
      title: input.title,
      type: input.type,
      department_id: input.department_id,
      date: input.date,
      time: input.time,
      location: input.location,
      description: input.description,
      expected_attendance: input.expected_attendance,
      budget: input.budget,
      updated_at: new Date(),
    })
    .where(eq(cemRequests.id, requestId));

  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: leadUserId,
    action: "request.draft_updated",
    target_type: "request",
    target_id: requestId,
    metadata: null,
  });
}

export async function submitRequest(
  tenantId: string,
  leadUserId: string,
  requestId: string,
): Promise<void> {
  const existing = await db
    .select({
      id: cemRequests.id,
      status: cemRequests.status,
      submitted_by: cemRequests.submitted_by,
      title: cemRequests.title,
    })
    .from(cemRequests)
    .where(and(eq(cemRequests.id, requestId), eq(cemRequests.tenant_id, tenantId)))
    .limit(1);
  if (existing.length === 0) throw new Error("not_found");
  if (!["draft", "returned"].includes(existing[0].status ?? "")) {
    throw new Error("invalid_state");
  }
  if (existing[0].submitted_by !== leadUserId) throw new Error("not_owner");

  const now = new Date();
  await db
    .update(cemRequests)
    .set({ status: "submitted", submitted_at: now, updated_at: now })
    .where(eq(cemRequests.id, requestId));

  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: leadUserId,
    action: "request.submitted",
    target_type: "request",
    target_id: requestId,
    metadata: JSON.stringify({ title: existing[0].title }),
  });

  // Fan-out: notify all admins + superadmins.
  const recipients = await getUsersByRoles(tenantId, ["admin", "superadmin"]);
  for (const recipient of recipients) {
    await createNotification({
      tenantId,
      recipientUserId: recipient,
      type: "request.submitted",
      title: "New event request",
      body: `"${existing[0].title}" was submitted for review.`,
      referenceType: "request",
      referenceId: requestId,
    });
  }
}

export async function claimRequest(
  tenantId: string,
  adminUserId: string,
  requestId: string,
): Promise<void> {
  const existing = await db
    .select({
      id: cemRequests.id,
      status: cemRequests.status,
      claimed_by: cemRequests.claimed_by,
      title: cemRequests.title,
      submitted_by: cemRequests.submitted_by,
    })
    .from(cemRequests)
    .where(and(eq(cemRequests.id, requestId), eq(cemRequests.tenant_id, tenantId)))
    .limit(1);
  if (existing.length === 0) throw new Error("not_found");
  if (existing[0].status !== "submitted") throw new Error("invalid_state");
  if (existing[0].claimed_by) throw new Error("already_claimed");

  const now = new Date();
  await db
    .update(cemRequests)
    .set({
      status: "under_review",
      claimed_by: adminUserId,
      claimed_at: now,
      updated_at: now,
    })
    .where(eq(cemRequests.id, requestId));

  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: adminUserId,
    action: "request.claimed",
    target_type: "request",
    target_id: requestId,
    metadata: null,
  });

  // Notify the submitter (if known).
  if (existing[0].submitted_by) {
    await createNotification({
      tenantId,
      recipientUserId: existing[0].submitted_by,
      type: "request.claimed",
      title: "Your request is under review",
      body: `An admin claimed "${existing[0].title}" for review.`,
      referenceType: "request",
      referenceId: requestId,
    });
  }
}

export async function forwardRequest(
  tenantId: string,
  adminUserId: string,
  requestId: string,
): Promise<void> {
  const existing = await db
    .select({
      id: cemRequests.id,
      status: cemRequests.status,
      claimed_by: cemRequests.claimed_by,
      title: cemRequests.title,
    })
    .from(cemRequests)
    .where(and(eq(cemRequests.id, requestId), eq(cemRequests.tenant_id, tenantId)))
    .limit(1);
  if (existing.length === 0) throw new Error("not_found");
  if (existing[0].status !== "under_review") throw new Error("invalid_state");
  if (existing[0].claimed_by !== adminUserId) throw new Error("not_claimer");

  const now = new Date();
  await db
    .update(cemRequests)
    .set({ status: "ready_for_approval", forwarded_at: now, updated_at: now })
    .where(eq(cemRequests.id, requestId));

  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: adminUserId,
    action: "request.forwarded",
    target_type: "request",
    target_id: requestId,
    metadata: null,
  });

  // Fan-out: notify all super admins.
  const recipients = await getUsersByRoles(tenantId, ["superadmin"]);
  for (const recipient of recipients) {
    await createNotification({
      tenantId,
      recipientUserId: recipient,
      type: "request.forwarded",
      title: "Request awaiting approval",
      body: `"${existing[0].title}" was forwarded for final approval.`,
      referenceType: "request",
      referenceId: requestId,
    });
  }
}

export async function returnRequest(
  tenantId: string,
  adminUserId: string,
  requestId: string,
  feedback: string,
): Promise<void> {
  const existing = await db
    .select({
      id: cemRequests.id,
      status: cemRequests.status,
      claimed_by: cemRequests.claimed_by,
      title: cemRequests.title,
      submitted_by: cemRequests.submitted_by,
    })
    .from(cemRequests)
    .where(and(eq(cemRequests.id, requestId), eq(cemRequests.tenant_id, tenantId)))
    .limit(1);
  if (existing.length === 0) throw new Error("not_found");
  if (existing[0].status !== "under_review") throw new Error("invalid_state");
  if (existing[0].claimed_by !== adminUserId) throw new Error("not_claimer");

  const now = new Date();
  await db
    .update(cemRequests)
    .set({ status: "returned", updated_at: now })
    .where(eq(cemRequests.id, requestId));

  await db.insert(cemRequestFeedback).values({
    request_id: requestId,
    author_id: adminUserId,
    content: feedback,
  });

  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: adminUserId,
    action: "request.returned",
    target_type: "request",
    target_id: requestId,
    metadata: null,
  });

  // Notify the submitter (if known).
  if (existing[0].submitted_by) {
    await createNotification({
      tenantId,
      recipientUserId: existing[0].submitted_by,
      type: "request.returned",
      title: "Request returned for revision",
      body: `"${existing[0].title}" was returned. Please review the feedback.`,
      referenceType: "request",
      referenceId: requestId,
    });
  }
}

export async function approveAndPublishRequest(
  tenantId: string,
  superUserId: string,
  requestId: string,
): Promise<{ eventId: string }> {
  const rows = await db
    .select()
    .from(cemRequests)
    .where(and(eq(cemRequests.id, requestId), eq(cemRequests.tenant_id, tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error("not_found");
  const r = rows[0];
  if (r.status !== "ready_for_approval") throw new Error("invalid_state");
  if (!r.date) throw new Error("date_required_for_publish");

  const now = new Date();
  const inserted = await db
    .insert(cemEvents)
    .values({
      tenant_id: tenantId,
      title: r.title,
      type: r.type,
      date: r.date,
      time: r.time,
      location: r.location,
      description: r.description,
      department_id: r.department_id,
      expected_attendance: r.expected_attendance,
      budget: r.budget,
      source_request_id: r.id,
      created_by: superUserId,
      created_at: now,
      updated_at: now,
    })
    .returning({ id: cemEvents.id });

  await db
    .update(cemRequests)
    .set({
      status: "approved",
      approved_by: superUserId,
      approved_at: now,
      updated_at: now,
    })
    .where(eq(cemRequests.id, requestId));

  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: superUserId,
    action: "request.approved",
    target_type: "request",
    target_id: requestId,
    metadata: JSON.stringify({ event_id: inserted[0].id }),
  });

  // Notify submitter + claiming admin (deduped).
  const recipients = new Set<string>();
  if (r.submitted_by) recipients.add(r.submitted_by);
  if (r.claimed_by) recipients.add(r.claimed_by);
  for (const recipient of recipients) {
    await createNotification({
      tenantId,
      recipientUserId: recipient,
      type: "request.approved",
      title: "Request approved",
      body: `"${r.title}" was approved and published.`,
      referenceType: "request",
      referenceId: requestId,
    });
  }

  return { eventId: inserted[0].id };
}

export async function sendBackRequestToAdmin(
  tenantId: string,
  superUserId: string,
  requestId: string,
): Promise<void> {
  const existing = await db
    .select({
      id: cemRequests.id,
      status: cemRequests.status,
      title: cemRequests.title,
      claimed_by: cemRequests.claimed_by,
    })
    .from(cemRequests)
    .where(and(eq(cemRequests.id, requestId), eq(cemRequests.tenant_id, tenantId)))
    .limit(1);
  if (existing.length === 0) throw new Error("not_found");
  if (existing[0].status !== "ready_for_approval") throw new Error("invalid_state");

  const now = new Date();
  await db
    .update(cemRequests)
    .set({ status: "under_review", updated_at: now })
    .where(eq(cemRequests.id, requestId));

  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: superUserId,
    action: "request.sent_back",
    target_type: "request",
    target_id: requestId,
    metadata: null,
  });

  // Notify the claiming admin so they can revise.
  if (existing[0].claimed_by) {
    await createNotification({
      tenantId,
      recipientUserId: existing[0].claimed_by,
      type: "request.sent_back",
      title: "Sent back for revision",
      body: `"${existing[0].title}" needs more work before approval.`,
      referenceType: "request",
      referenceId: requestId,
    });
  }
}

export async function deleteRequest(
  tenantId: string,
  superUserId: string,
  requestId: string,
): Promise<void> {
  const existing = await db
    .select({
      id: cemRequests.id,
      title: cemRequests.title,
      status: cemRequests.status,
      submitted_by: cemRequests.submitted_by,
      claimed_by: cemRequests.claimed_by,
    })
    .from(cemRequests)
    .where(and(eq(cemRequests.id, requestId), eq(cemRequests.tenant_id, tenantId)))
    .limit(1);
  if (existing.length === 0) throw new Error("not_found");

  const now = new Date();
  await db
    .update(cemRequests)
    .set({ status: "deleted", deleted_at: now, updated_at: now })
    .where(eq(cemRequests.id, requestId));

  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: superUserId,
    action: "request.deleted",
    target_type: "request",
    target_id: requestId,
    metadata: JSON.stringify({ title: existing[0].title, prior_status: existing[0].status }),
  });

  // Notify submitter + claiming admin so they're aware (deduped).
  const recipients = new Set<string>();
  if (existing[0].submitted_by) recipients.add(existing[0].submitted_by);
  if (existing[0].claimed_by) recipients.add(existing[0].claimed_by);
  for (const recipient of recipients) {
    await createNotification({
      tenantId,
      recipientUserId: recipient,
      type: "request.deleted",
      title: "Request deleted",
      body: `"${existing[0].title}" was deleted by a super admin.`,
      referenceType: "request",
      referenceId: requestId,
    });
  }
}

// ── Convenience: filter helpers ─────────────────────────────────────

export function filterByStatus<T extends { status: RequestStatus }>(
  rows: T[],
  statuses: RequestStatus[],
): T[] {
  const set = new Set(statuses);
  return rows.filter((r) => set.has(r.status));
}

// Re-export for convenience.
export { cemRequests };
