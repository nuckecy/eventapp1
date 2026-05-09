// Birthday query helpers — F10 (public view). Self-service write APIs
// arrive in F11; the unmapped-pool admin endpoints in F12. Admin
// "with year + age" listing arrives alongside F12.
//
// SECURITY (PRD Section 16, rule 6 — non-negotiable):
//
//   "Birthday `year` is NEVER returned in public or authenticated
//    birthday list endpoints. Only /api/me/birthday (own data) and
//    admin endpoints with ?admin=true return year."
//
// Architectural enforcement:
//
//   1. listBirthdaysForView() does NOT select cemBirthdays.year. Only
//      day, month, show_age, and the user_id / department metadata.
//   2. Landmark info is derived from (CURRENT_YEAR - year) entirely
//      in the database (a SQL CASE expression), so the year never
//      leaves the SQL execution context for non-admin viewers.
//   3. The returned DTO (BirthdayListItem) has no `year` key in its
//      TypeScript shape. Even a future bug rendering the whole row
//      cannot leak the year.
//   4. For admin viewers, we also compute `age` server-side; we still
//      do not return the raw year.
//
// Tenant scoping (rule 4): every query filters by `tenant_id`.

import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cemBirthdays,
  cemBirthdaysUnmapped,
  cemDepartments,
  coreUsers,
} from "@/db/schema";
import type { BirthdayListItem, LandmarkColor } from "./types";

/** Anchor year for landmark calculations. Tests can mock by passing
 *  it explicitly; the page layer pulls from the system clock. */
function thisYear(now: Date = new Date()): number {
  return now.getFullYear();
}

/** What the viewer is allowed to see. Affects whether age/landmark
 *  data appears on landmark rows where the person hasn't opted in. */
export type BirthdayViewerRole =
  | "anonymous" // not signed in
  | "member" // signed in, no special privilege
  | "admin"; // admin / superadmin / platform_admin — sees Turning {age}

/**
 * List the tenant's mapped birthdays in a year-safe shape.
 *
 * The viewerRole determines the visibility rules applied server-side
 * to landmark tags. The DTO never contains the raw birth year for
 * any role — admin viewers see the derived `age` instead.
 */
export async function listBirthdaysForView(
  tenantId: string,
  viewerRole: BirthdayViewerRole,
  now: Date = new Date(),
): Promise<BirthdayListItem[]> {
  const currentYear = thisYear(now);
  const isAdminViewer = viewerRole === "admin";

  // Landmark age set: 10, 20, 30, 40, 50, 60, 70, 80, 90.
  // We render the SQL membership check inline rather than passing a
  // SQL array (Drizzle adds quoting headaches for IN with literals
  // when the values are constant integers from app code).

  // Computed in SQL:
  //   age_now = currentYear - year   (NULL when year is NULL)
  //   is_landmark_age = age_now ∈ {10,20,30,40,50,60,70,80,90}
  //   landmark_color = age_now <= 40 ? 'blue' : 'green'   (when landmark)
  //
  // Visibility rule applied here:
  //   admin viewer → tag visible whenever it's a landmark
  //   non-admin    → tag visible only when show_age = true
  //
  // The age field is returned only for admin viewers. The raw year
  // is never selected.
  const ageExpr = sql<number | null>`(${currentYear} - ${cemBirthdays.year})`;
  const isLandmarkExpr = sql<boolean>`(
    (${currentYear} - ${cemBirthdays.year}) IN (10, 20, 30, 40, 50, 60, 70, 80, 90)
  )`;
  const landmarkColorExpr = sql<LandmarkColor | null>`
    CASE
      WHEN (${currentYear} - ${cemBirthdays.year}) IN (10, 20, 30, 40)
        THEN 'blue'
      WHEN (${currentYear} - ${cemBirthdays.year}) IN (50, 60, 70, 80, 90)
        THEN 'green'
      ELSE NULL
    END
  `;

  const rows = await db
    .select({
      id: cemBirthdays.id,
      user_id: cemBirthdays.user_id,
      name: coreUsers.name,
      day: cemBirthdays.day,
      month: cemBirthdays.month,
      show_age: cemBirthdays.show_age,
      department_id: cemBirthdays.department_id,
      department_name: cemDepartments.name,
      // Computed landmark fields. `_age` is only used downstream when
      // viewerRole === "admin" — we still don't ship the raw year.
      _age: ageExpr,
      _isLandmarkAge: isLandmarkExpr,
      _landmarkColor: landmarkColorExpr,
    })
    .from(cemBirthdays)
    .innerJoin(coreUsers, eq(coreUsers.id, cemBirthdays.user_id))
    .leftJoin(
      cemDepartments,
      eq(cemDepartments.id, cemBirthdays.department_id),
    )
    .where(eq(cemBirthdays.tenant_id, tenantId))
    .orderBy(asc(cemBirthdays.month), asc(cemBirthdays.day));

  return rows.map((r): BirthdayListItem => {
    const showAge = r.show_age ?? false;
    const isLandmarkAge = Boolean(r._isLandmarkAge);
    // Visibility rule: admin sees all landmark rows; everyone else
    // only when the person opted in.
    const showTag = isLandmarkAge && (isAdminViewer || showAge);
    return {
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      day: r.day,
      month: r.month,
      department_id: r.department_id,
      department_name: r.department_name,
      isLandmark: showTag,
      landmarkColor: showTag ? (r._landmarkColor as LandmarkColor | null) : null,
      // age is only included for admin viewers and only on visible
      // landmarks. Otherwise null.
      age: showTag && isAdminViewer ? (r._age as number | null) : null,
    };
  });
}

/** Convenience: count of unmapped birthday records, for the admin
 *  banner (the F12 Unmapped Pool feature implements the actual list).
 *  Used by F10 only to decide whether to show the banner stub. */
export async function countUnmappedBirthdays(tenantId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cemBirthdaysUnmapped)
    .where(
      and(
        eq(cemBirthdaysUnmapped.tenant_id, tenantId),
        eq(cemBirthdaysUnmapped.status, "pending"),
      ),
    );
  return result[0]?.count ?? 0;
}
