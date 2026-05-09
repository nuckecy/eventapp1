// Notification system (F17). Each state transition in F14-F16 calls
// these helpers to fan out a notification to the right recipients.
//
// SECURITY:
// - Tenant scoping unconditional.
// - Notifications can only ever be read by the user_id they were
//   addressed to — enforced at the read layer (listOwnNotifications)
//   and at the row level by Supabase RLS policy (F03's rls_policies
//   allows SELECT only when user_id = auth.uid()).
// - Bodies are built from predefined templates here; no raw user
//   input ever lands in the body string (the action passes a request
//   title which itself is Zod-validated upstream).

import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  cemNotifications,
  coreTenantUserRoles,
  coreApps,
} from "@/db/schema";

export type NotificationType =
  | "request.submitted"
  | "request.claimed"
  | "request.forwarded"
  | "request.approved"
  | "request.returned"
  | "request.sent_back"
  | "request.deleted";

type NotifyArgs = {
  tenantId: string;
  /** The user who should receive this notification. */
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body?: string;
  referenceType?: "request" | "event" | "birthday" | null;
  referenceId?: string | null;
};

export async function createNotification(args: NotifyArgs): Promise<void> {
  await db.insert(cemNotifications).values({
    tenant_id: args.tenantId,
    user_id: args.recipientUserId,
    type: args.type,
    title: args.title,
    body: args.body ?? null,
    reference_type: args.referenceType ?? null,
    reference_id: args.referenceId ?? null,
  });
}

/**
 * List the userId of every member with a CEM role in the given tenant
 * matching one of the requested roles. Used to fan-out notifications
 * (e.g. notify all admins when a request is submitted).
 */
export async function getUsersByRoles(
  tenantId: string,
  roles: string[],
): Promise<string[]> {
  if (roles.length === 0) return [];
  const app = await db
    .select({ id: coreApps.id })
    .from(coreApps)
    .where(eq(coreApps.slug, "cem"))
    .limit(1);
  if (app.length === 0) return [];
  const rows = await db
    .select({ user_id: coreTenantUserRoles.user_id })
    .from(coreTenantUserRoles)
    .where(
      and(
        eq(coreTenantUserRoles.tenant_id, tenantId),
        eq(coreTenantUserRoles.app_id, app[0].id),
        inArray(coreTenantUserRoles.role, roles),
      ),
    );
  return rows.map((r) => r.user_id);
}

/** List the calling user's notifications (RLS also enforces this). */
export async function listOwnNotifications(
  tenantId: string,
  userId: string,
  limit = 20,
) {
  return db
    .select({
      id: cemNotifications.id,
      title: cemNotifications.title,
      body: cemNotifications.body,
      type: cemNotifications.type,
      reference_type: cemNotifications.reference_type,
      reference_id: cemNotifications.reference_id,
      read: cemNotifications.read,
      muted: cemNotifications.muted,
      created_at: cemNotifications.created_at,
    })
    .from(cemNotifications)
    .where(
      and(eq(cemNotifications.tenant_id, tenantId), eq(cemNotifications.user_id, userId)),
    )
    .orderBy(desc(cemNotifications.created_at))
    .limit(limit);
}

export async function countUnread(tenantId: string, userId: string): Promise<number> {
  const rows = await db
    .select({ id: cemNotifications.id })
    .from(cemNotifications)
    .where(
      and(
        eq(cemNotifications.tenant_id, tenantId),
        eq(cemNotifications.user_id, userId),
        eq(cemNotifications.read, false),
        eq(cemNotifications.muted, false),
      ),
    );
  return rows.length;
}

export async function markRead(
  tenantId: string,
  userId: string,
  notificationId: string,
): Promise<void> {
  await db
    .update(cemNotifications)
    .set({ read: true })
    .where(
      and(
        eq(cemNotifications.id, notificationId),
        eq(cemNotifications.tenant_id, tenantId),
        eq(cemNotifications.user_id, userId),
      ),
    );
}

export async function toggleMute(
  tenantId: string,
  userId: string,
  notificationId: string,
  muted: boolean,
): Promise<void> {
  await db
    .update(cemNotifications)
    .set({ muted })
    .where(
      and(
        eq(cemNotifications.id, notificationId),
        eq(cemNotifications.tenant_id, tenantId),
        eq(cemNotifications.user_id, userId),
      ),
    );
}
