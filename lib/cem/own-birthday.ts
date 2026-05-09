// Own-birthday helpers — F11 self-service.
//
// SECURITY (PRD Section 16, rule 6): This is the ONE place where the
// birth `year` is allowed to be returned. The query and the response
// shape are scoped to the authenticated user's own row only. The
// caller (the route handler / page) is responsible for getting the
// userId from the session — never from the request body or URL.

import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cemBirthdays } from "@/db/schema";

export type OwnBirthday = {
  id: string | null;
  /** YYYY-MM-DD or null if the user has not set a birthday yet. */
  day: number | null;
  month: number | null;
  year: number | null;
  show_age: boolean;
  department_id: string | null;
};

/**
 * Look up the user's own birthday row in the given tenant. Returns a
 * sentinel "empty" record when no row exists yet so the UI can
 * render the editor without a separate "create" path.
 *
 * SECURITY: `userId` is the caller's authenticated id. The query
 * filters on (tenant_id, user_id) — even if userId were spoofable
 * (it isn't; comes from getSession()), tenant scoping is enforced.
 */
export async function getOwnBirthday(
  tenantId: string,
  userId: string,
): Promise<OwnBirthday> {
  const rows = await db
    .select({
      id: cemBirthdays.id,
      day: cemBirthdays.day,
      month: cemBirthdays.month,
      year: cemBirthdays.year,
      show_age: cemBirthdays.show_age,
      department_id: cemBirthdays.department_id,
    })
    .from(cemBirthdays)
    .where(and(eq(cemBirthdays.tenant_id, tenantId), eq(cemBirthdays.user_id, userId)))
    .limit(1);

  if (rows.length === 0) {
    return { id: null, day: null, month: null, year: null, show_age: false, department_id: null };
  }
  const r = rows[0];
  return {
    id: r.id,
    day: r.day,
    month: r.month,
    year: r.year ?? null,
    show_age: r.show_age ?? false,
    department_id: r.department_id,
  };
}

export type UpsertOwnBirthdayInput = {
  day: number; // 1-31
  month: number; // 1-12
  /** Year may be null (user can omit). When provided: 1900 ≤ year ≤ currentYear. */
  year: number | null;
  show_age: boolean;
};

/**
 * Insert or update the user's own birthday.
 *
 * EC-03: a unique constraint `cem_birthdays_tenant_user_unique` now
 * covers (tenant_id, user_id), so we use atomic onConflictDoUpdate.
 * This eliminates the SELECT-then-INSERT race where two simultaneous
 * PUTs from the same user could create duplicate rows. The Admin's
 * "map an unmapped record" path also benefits — see mapBirthdayAction.
 *
 * SECURITY: Same scoping rules. day/month/year are validated by the
 * caller (route handler) via Zod before reaching this function;
 * server-side bounds-check here is defence in depth.
 */
export async function upsertOwnBirthday(
  tenantId: string,
  userId: string,
  input: UpsertOwnBirthdayInput,
): Promise<void> {
  // Bounds-check (defence in depth — Zod is the primary guard).
  if (input.day < 1 || input.day > 31) throw new Error("day out of range");
  if (input.month < 1 || input.month > 12) throw new Error("month out of range");
  if (input.year != null) {
    const currentYear = new Date().getFullYear();
    if (input.year < 1900 || input.year > currentYear) {
      throw new Error("year out of range");
    }
  }

  await db
    .insert(cemBirthdays)
    .values({
      tenant_id: tenantId,
      user_id: userId,
      day: input.day,
      month: input.month,
      year: input.year,
      show_age: input.show_age,
    })
    .onConflictDoUpdate({
      target: [cemBirthdays.tenant_id, cemBirthdays.user_id],
      set: {
        day: input.day,
        month: input.month,
        year: input.year,
        show_age: input.show_age,
        updated_at: new Date(),
      },
    });
}
