// Unmapped birthday pool — admin-only data layer (F12).
//
// SECURITY:
// - All callers must verify admin role before invoking these helpers.
//   The route handlers do that at the page/handler boundary; the
//   data layer trusts the caller.
// - Tenant scoping is enforced unconditionally.
// - All actions write an audit-log entry — required by F18 + PRD §16#5.

import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cemAuditLog, cemBirthdays, cemBirthdaysUnmapped } from "@/db/schema";

export type UnmappedBirthdayItem = {
  id: string;
  name: string;
  day: number;
  month: number;
  // year is allowed here — admin endpoint per PRD §16 rule 6.
  year: number | null;
  suggest_match_user_id: string | null;
  suggest_match_name: string | null;
  suggest_confidence: number | null;
};

/**
 * List pending unmapped birthday records for a tenant. Admin-only.
 * The `year` column IS allowed here because this is an admin endpoint
 * (PRD §16#6 explicitly carves out admin endpoints).
 */
export async function listUnmappedBirthdays(
  tenantId: string,
): Promise<UnmappedBirthdayItem[]> {
  const rows = await db
    .select({
      id: cemBirthdaysUnmapped.id,
      name: cemBirthdaysUnmapped.name,
      day: cemBirthdaysUnmapped.day,
      month: cemBirthdaysUnmapped.month,
      year: cemBirthdaysUnmapped.year,
      suggest_match_user_id: cemBirthdaysUnmapped.suggest_match_user_id,
      suggest_match_name: cemBirthdaysUnmapped.suggest_match_name,
      suggest_confidence: cemBirthdaysUnmapped.suggest_confidence,
    })
    .from(cemBirthdaysUnmapped)
    .where(
      and(
        eq(cemBirthdaysUnmapped.tenant_id, tenantId),
        eq(cemBirthdaysUnmapped.status, "pending"),
      ),
    )
    .orderBy(asc(cemBirthdaysUnmapped.month), asc(cemBirthdaysUnmapped.day));
  return rows;
}

/**
 * Map an unmapped record to a real user. Creates the cem_birthdays
 * row (or updates if one exists), marks the unmapped record as
 * "mapped", and writes an audit-log entry.
 */
export async function mapUnmappedBirthday(
  tenantId: string,
  unmappedId: string,
  targetUserId: string,
  actorId: string,
): Promise<void> {
  // Fetch the unmapped row (and verify tenant scope).
  const unmappedRows = await db
    .select()
    .from(cemBirthdaysUnmapped)
    .where(
      and(
        eq(cemBirthdaysUnmapped.id, unmappedId),
        eq(cemBirthdaysUnmapped.tenant_id, tenantId),
      ),
    )
    .limit(1);
  const u = unmappedRows[0];
  if (!u) throw new Error("not_found");
  if (u.status !== "pending") throw new Error("already_processed");

  // Upsert the cem_birthdays row for the target user.
  const existing = await db
    .select({ id: cemBirthdays.id })
    .from(cemBirthdays)
    .where(
      and(
        eq(cemBirthdays.tenant_id, tenantId),
        eq(cemBirthdays.user_id, targetUserId),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(cemBirthdays).values({
      tenant_id: tenantId,
      user_id: targetUserId,
      day: u.day,
      month: u.month,
      year: u.year,
      show_age: false,
    });
  } else {
    await db
      .update(cemBirthdays)
      .set({
        day: u.day,
        month: u.month,
        year: u.year,
        updated_at: new Date(),
      })
      .where(eq(cemBirthdays.id, existing[0].id));
  }

  // Mark the unmapped row done.
  await db
    .update(cemBirthdaysUnmapped)
    .set({
      status: "mapped",
      mapped_to_user_id: targetUserId,
      mapped_at: new Date(),
      mapped_by: actorId,
    })
    .where(eq(cemBirthdaysUnmapped.id, unmappedId));

  // Audit log (INSERT-only enforced at DB level).
  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: actorId,
    action: "birthday.mapped",
    target_type: "birthday",
    target_id: unmappedId,
    metadata: JSON.stringify({ user_id: targetUserId }),
  });
}

/**
 * Dismiss an unmapped record without mapping. Marks status=dismissed,
 * audit-logged.
 */
export async function dismissUnmappedBirthday(
  tenantId: string,
  unmappedId: string,
  actorId: string,
): Promise<void> {
  const result = await db
    .update(cemBirthdaysUnmapped)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(cemBirthdaysUnmapped.id, unmappedId),
        eq(cemBirthdaysUnmapped.tenant_id, tenantId),
        eq(cemBirthdaysUnmapped.status, "pending"),
      ),
    )
    .returning({ id: cemBirthdaysUnmapped.id });
  if (result.length === 0) throw new Error("not_found_or_already_processed");

  await db.insert(cemAuditLog).values({
    tenant_id: tenantId,
    actor_id: actorId,
    action: "birthday.dismissed",
    target_type: "birthday",
    target_id: unmappedId,
    metadata: null,
  });
}
