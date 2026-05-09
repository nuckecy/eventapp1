// Demote any seed/fixture user that was given is_platform_admin=true.
//
// Original seed code marked pastor.james (now pastor.james@demo.local
// after the demo migration) as platform admin for testing convenience.
// That was a fixture choice; real platform admin should be a real
// human. This script flips is_platform_admin=false on any user whose
// email ends in @demo.local — those are the seed fixtures.
//
// Their per-tenant roles (e.g. superadmin on demo) are NOT touched —
// the demoted user stays useful as a demo persona, just no longer
// god-mode.
//
// Idempotent: re-running has no effect once the seed users are
// already non-admin.
//
// Run: npx tsx --env-file=.env scripts/demote-seed-platform-admin.ts

import "dotenv/config";
import postgres from "postgres";

(async () => {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL or DIRECT_URL not set. Aborting.");
    process.exit(1);
  }
  const sql = postgres(url);

  try {
    // Find seed-fixture users currently flagged as platform admin.
    const seeds = await sql<{ id: string; email: string }[]>`
      SELECT id, email
      FROM core_users
      WHERE is_platform_admin = true
        AND email LIKE '%@demo.local'
    `;

    if (seeds.length === 0) {
      console.log("No seed-fixture platform admins found. Nothing to do.");
      await sql.end();
      return;
    }

    console.log(`Found ${seeds.length} seed-fixture platform admin(s):`);
    for (const u of seeds) console.log(`  - ${u.email}`);

    // Demote them in a single statement.
    await sql`
      UPDATE core_users
      SET is_platform_admin = false
      WHERE is_platform_admin = true
        AND email LIKE '%@demo.local'
    `;
    console.log(`✅ Demoted ${seeds.length} user(s) to non-platform-admin.`);
    console.log("   Their tenant-level roles (e.g. superadmin on demo) are unchanged.");
  } catch (e) {
    console.error("❌ Demote failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();
