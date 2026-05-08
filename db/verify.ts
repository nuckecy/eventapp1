// Quick post-seed verification: counts every table to confirm Section 15
// expectations are met. Used after `npm run db:seed`.
//
// SECURITY: Uses Drizzle's typed table objects (no string interpolation
// into SQL). Per SECURITY_TEST.md rule 2: parameterized queries only.
//
// Run with: `npx tsx --env-file=.env db/verify.ts`

import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "./index";
import {
  cemAuditLog,
  cemBirthdays,
  cemBirthdaysUnmapped,
  cemDepartments,
  cemEvents,
  cemHolidays,
  cemNotifications,
  cemRequestFeedback,
  cemRequests,
  coreApps,
  coreTenantApps,
  coreTenantDomains,
  coreTenantUserRoles,
  coreTenantUsers,
  coreTenants,
  coreUsers,
} from "./schema";

async function count(table: PgTable): Promise<number> {
  const rows = await db.select({ c: sql<number>`count(*)::int` }).from(table);
  return rows[0]?.c ?? 0;
}

async function main() {
  const expectations: Array<{ name: string; table: PgTable; expected: number }> = [
    { name: "core_tenants", table: coreTenants, expected: 1 },
    { name: "core_apps", table: coreApps, expected: 1 },
    { name: "core_tenant_apps", table: coreTenantApps, expected: 1 },
    { name: "core_users", table: coreUsers, expected: 18 }, // 4 demo + 14 birthday extras
    { name: "core_tenant_users", table: coreTenantUsers, expected: 18 },
    { name: "core_tenant_user_roles", table: coreTenantUserRoles, expected: 18 },
    { name: "cem_departments", table: cemDepartments, expected: 6 },
    { name: "cem_events", table: cemEvents, expected: 25 },
    { name: "cem_holidays", table: cemHolidays, expected: 21 },
    { name: "cem_requests", table: cemRequests, expected: 7 },
    { name: "cem_birthdays", table: cemBirthdays, expected: 15 },
    { name: "cem_birthdays_unmapped", table: cemBirthdaysUnmapped, expected: 6 },
    { name: "cem_audit_log", table: cemAuditLog, expected: 0 }, // populated in F18
    { name: "cem_notifications", table: cemNotifications, expected: 0 }, // populated in F17
    { name: "cem_request_feedback", table: cemRequestFeedback, expected: 0 }, // populated in F15
    { name: "core_tenant_domains", table: coreTenantDomains, expected: 0 }, // populated in F20
  ];

  let failures = 0;
  for (const { name, table, expected } of expectations) {
    const actual = await count(table);
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${name.padEnd(28)} ${actual} (expected ${expected})`);
  }

  if (failures > 0) {
    console.error(`\n✗ ${failures} mismatch(es)`);
    process.exit(1);
  }
  console.log("\n✓ All table counts match Section 15 expectations.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verify failed:", err);
    process.exit(1);
  });
