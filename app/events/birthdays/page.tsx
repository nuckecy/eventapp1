// Birthdays page — public view (FR-4, F10).
//
// This page is the most security-sensitive read-only page in the app.
// PRD Section 16, key rule #6:
//
//   "Birthday year is NEVER returned in public or authenticated
//    birthday list endpoints. Only /api/me/birthday (own data) and
//    admin endpoints with ?admin=true return year."
//
// Architectural enforcement:
//
//  1. lib/cem/birthdays.ts: listBirthdaysForView() does NOT select
//     the `year` column. Landmark calculations happen server-side
//     in SQL; only `isLandmark`, `landmarkColor`, and (for admin
//     viewers) `age` come back.
//
//  2. The DTO type (BirthdayListItem) has no `year` key. Even a
//     future bug rendering the whole row cannot leak the year —
//     TypeScript stops it at compile time.
//
//  3. The viewer role drives both visibility (admin sees all
//     landmark tags; non-admin only sees them when the person opted
//     in) AND the age field (only included for admin viewers). The
//     server applies the rule before sending data; the client never
//     gets enough to derive a non-admin "Turning N" tag.
//
// F11 (self-service) replaces the bar stub here with the real edit
// flow + /api/me/birthday endpoint (the only place year IS allowed).
// F12 (unmapped pool) replaces the banner stub with expand/Map/Dismiss.

import { BirthdaySelfService } from "@/components/cem/birthday-self-service";
import { CurrentMonthSection } from "@/components/cem/birthday-month-section";
import { LoginPromptBanner } from "@/components/cem/login-prompt-banner";
import { OtherMonthsGrid } from "@/components/cem/other-months-grid";
import { UnmappedPool } from "@/components/cem/unmapped-pool";
import { getSession } from "@/lib/auth/session";
import {
  listBirthdaysForView,
  type BirthdayViewerRole,
} from "@/lib/cem/birthdays";
import { getCurrentTenantId } from "@/lib/cem/events";
import { getOwnBirthday } from "@/lib/cem/own-birthday";
import { listUnmappedBirthdays } from "@/lib/cem/unmapped-birthdays";
import type { BirthdayListItem } from "@/lib/cem/types";

export const metadata = { title: "Birthdays · Church Event Management" };

function pickViewerRole(
  session: Awaited<ReturnType<typeof getSession>>,
): BirthdayViewerRole {
  if (!session) return "anonymous";
  if (
    session.role === "admin" ||
    session.role === "superadmin" ||
    session.role === "platform_admin"
  ) {
    return "admin";
  }
  return "member";
}

function groupByMonth(birthdays: BirthdayListItem[]): Map<number, BirthdayListItem[]> {
  // month is 1-12 in the DB; convert to 0-11 for our date helpers.
  const map = new Map<number, BirthdayListItem[]>();
  for (const b of birthdays) {
    const idx = b.month - 1;
    const bucket = map.get(idx);
    if (bucket) bucket.push(b);
    else map.set(idx, [b]);
  }
  return map;
}

export default async function BirthdaysPage() {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <h1 className="font-display text-[28px] font-medium">Birthdays</h1>
        <p className="mt-3 text-[13px] text-cal-text-secondary">
          No tenant context. Visit via a tenant subdomain.
        </p>
      </div>
    );
  }

  const session = await getSession();
  const viewerRole = pickViewerRole(session);
  const isAdminViewer = viewerRole === "admin";

  // Today's wall-clock month/day for the "THIS MONTH" highlight + Today
  // badge. Uses the system clock; the calendar is a wall-clock calendar
  // so timezone drift doesn't apply.
  const now = new Date();
  const todayMonthIdx = now.getMonth();
  const todayDay = now.getDate();

  // Fetch in parallel; all tenant-scoped server-side. Own birthday only
  // fetched when authenticated (the only place year is allowed to come back).
  // Unmapped pool fetched only when admin (year is allowed for admin).
  const [birthdays, unmappedRecords, ownBirthday] = await Promise.all([
    listBirthdaysForView(tenantId, viewerRole, now),
    isAdminViewer ? listUnmappedBirthdays(tenantId) : Promise.resolve([]),
    session ? getOwnBirthday(tenantId, session.userId) : Promise.resolve(null),
  ]);

  // Group + sort.
  const byMonth = groupByMonth(birthdays);
  const currentMonthBirthdays = byMonth.get(todayMonthIdx) ?? [];

  // Other months: future first, then past, both ascending by index
  // within their group. Past months render at 55% opacity.
  const otherMonthIndexes = Array.from(byMonth.keys()).filter((m) => m !== todayMonthIdx);
  const futureMonths = otherMonthIndexes.filter((m) => m > todayMonthIdx).sort((a, b) => a - b);
  const pastMonths = otherMonthIndexes.filter((m) => m < todayMonthIdx).sort((a, b) => a - b);
  const buckets = [
    ...futureMonths.map((m) => ({
      monthIndex: m,
      birthdays: byMonth.get(m) ?? [],
      past: false,
    })),
    ...pastMonths.map((m) => ({
      monthIndex: m,
      birthdays: byMonth.get(m) ?? [],
      past: true,
    })),
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <header className="mb-8">
        <h1 className="font-display text-[28px] font-medium leading-tight">Birthdays</h1>
        <p className="mt-2 text-[13px] text-cal-text-secondary">
          Celebrate with our church family.
        </p>
      </header>

      {/* Self-service bar (auth) or login prompt (anon). */}
      {session && ownBirthday ? (
        <BirthdaySelfService
          initial={{
            day: ownBirthday.day,
            month: ownBirthday.month,
            year: ownBirthday.year,
            show_age: ownBirthday.show_age,
          }}
          userName={session.name ?? session.email ?? "there"}
        />
      ) : (
        <LoginPromptBanner nextPath="/events/birthdays" />
      )}

      {/* Admin-only unmapped pool (F12). */}
      {isAdminViewer ? <UnmappedPool records={unmappedRecords} /> : null}

      {birthdays.length === 0 ? (
        <div className="rounded-lg border border-cal-border bg-cal-card-bg px-6 py-12 text-center text-[13px] text-cal-text-secondary">
          No birthdays on file yet.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <CurrentMonthSection
            monthIndex={todayMonthIdx}
            birthdays={currentMonthBirthdays}
            todayDay={todayDay}
          />
          <OtherMonthsGrid buckets={buckets} />
        </div>
      )}
    </div>
  );
}
