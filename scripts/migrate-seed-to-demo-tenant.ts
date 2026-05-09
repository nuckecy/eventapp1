// One-shot data migration: re-parent the seed dataset (currently on
// the "newsong" tenant) onto a new "demo" tenant, then delete the
// newsong tenant + rename test users to @demo.local.
//
// Why: "newsong" is now a real prospective customer's name. The
// existing seed data is a demo/showcase dataset, not theirs. We
// move the data so the slug "newsong" can later be claimed by
// the real customer with a fresh, empty workspace.
//
// What this script does (atomic, all-or-nothing in one transaction):
//   1. Insert a new tenant: slug='demo', name='Demo Church'.
//   2. Enable the CEM app for the demo tenant.
//   3. UPDATE every cem_* row's tenant_id from newsong → demo.
//   4. UPDATE core_tenant_users + core_tenant_user_roles similarly.
//   5. UPDATE core_users.email: replace any non-@demo.local domain
//      with @demo.local on users who only belong to the demo tenant.
//   6. DELETE the newsong tenant row (cascade clears its tenant_apps).
//
// SAFETY:
// - Single transaction. Any error rolls everything back.
// - Pre-checks: refuses to run if a tenant with slug='demo' already
//   exists (prevents a re-run from corrupting state).
// - Refuses to run if more than one tenant exists (don't auto-pick).
// - Refuses if the newsong tenant has zero data — nothing to move.
//
// Run: npx tsx --env-file=.env scripts/migrate-seed-to-demo-tenant.ts

import "dotenv/config";
import postgres from "postgres";

const NEW_SLUG = "demo";
const NEW_NAME = "Demo Church";
const NEW_EMAIL_DOMAIN = "demo.local";

(async () => {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL or DIRECT_URL not set");
    process.exit(1);
  }
  const sql = postgres(url);

  try {
    // Pre-flight checks ─────────────────────────────────────────────
    const tenants = await sql<
      { id: string; slug: string; name: string }[]
    >`SELECT id, slug, name FROM core_tenants ORDER BY created_at`;

    if (tenants.length === 0) {
      throw new Error("No tenants found. Aborting.");
    }
    if (tenants.find((t) => t.slug === NEW_SLUG)) {
      throw new Error(
        `Tenant with slug='${NEW_SLUG}' already exists. Refusing to run.`,
      );
    }
    if (tenants.length > 1) {
      throw new Error(
        `Multiple tenants exist (${tenants
          .map((t) => t.slug)
          .join(", ")}). Refusing to auto-pick. Aborting.`,
      );
    }

    const source = tenants[0];
    console.log(`Source tenant: ${source.slug} (${source.id})`);
    console.log(`Target tenant: ${NEW_SLUG} (${NEW_NAME})`);

    // Sanity-check there's data to move.
    const eventCount = await sql<{ n: string }[]>`
      SELECT COUNT(*) as n FROM cem_events WHERE tenant_id = ${source.id}
    `;
    if (Number(eventCount[0].n) === 0) {
      throw new Error(
        `Source tenant ${source.slug} has no events. Likely already migrated. Aborting.`,
      );
    }

    // Find the CEM app id (we need it for the new tenant_apps row).
    const cemApp = await sql<{ id: string }[]>`
      SELECT id FROM core_apps WHERE slug = 'cem' LIMIT 1
    `;
    if (cemApp.length === 0) {
      throw new Error("core_apps row for slug='cem' not found. Aborting.");
    }
    const cemAppId = cemApp[0].id;

    // Find users that ONLY belong to the source tenant — they get
    // their emails renamed to @demo.local. Users who also belong to
    // other tenants (none yet, but future-proofing) are left alone.
    const seedUsers = await sql<{ id: string; email: string }[]>`
      SELECT u.id, u.email
      FROM core_users u
      WHERE u.id IN (
        SELECT user_id FROM core_tenant_users
        WHERE tenant_id = ${source.id}
      )
      AND NOT EXISTS (
        SELECT 1 FROM core_tenant_users tu2
        WHERE tu2.user_id = u.id AND tu2.tenant_id != ${source.id}
      )
    `;
    console.log(`Found ${seedUsers.length} seed users to rename.`);

    // ── Begin transaction ──────────────────────────────────────────
    await sql.begin(async (tx) => {
      // 1. Create the new demo tenant.
      const inserted = await tx<{ id: string }[]>`
        INSERT INTO core_tenants (slug, name, status)
        VALUES (${NEW_SLUG}, ${NEW_NAME}, 'active')
        RETURNING id
      `;
      const demoId = inserted[0].id;
      console.log(`Created demo tenant: ${demoId}`);

      // 2. Enable CEM for the new tenant.
      await tx`
        INSERT INTO core_tenant_apps (tenant_id, app_id, enabled)
        VALUES (${demoId}, ${cemAppId}, true)
      `;

      // 3. Re-parent all cem_* rows (alphabetical, doesn't matter for
      //    correctness in a single transaction).
      const tables = [
        "cem_audit_log",
        "cem_birthdays",
        "cem_birthdays_unmapped",
        "cem_departments",
        "cem_events",
        "cem_holidays",
        "cem_notifications",
        "cem_requests",
      ];
      for (const t of tables) {
        const result = await tx.unsafe(
          `UPDATE ${t} SET tenant_id = $1 WHERE tenant_id = $2`,
          [demoId, source.id],
        );
        console.log(`  ${t}: re-parented ${result.count} rows`);
      }

      // cem_request_feedback is keyed by request_id (which we just
      // updated) — no tenant_id of its own. Nothing to do.

      // 4. Re-parent membership + role rows.
      await tx`
        UPDATE core_tenant_users
        SET tenant_id = ${demoId}
        WHERE tenant_id = ${source.id}
      `;
      await tx`
        UPDATE core_tenant_user_roles
        SET tenant_id = ${demoId}
        WHERE tenant_id = ${source.id}
      `;

      // 5. Rename seed user emails to @demo.local. We only touch
      //    users that ONLY belong to the source tenant (verified above).
      for (const user of seedUsers) {
        const localPart = user.email.split("@")[0];
        const newEmail = `${localPart}@${NEW_EMAIL_DOMAIN}`;
        if (user.email === newEmail) continue;
        await tx`
          UPDATE core_users SET email = ${newEmail} WHERE id = ${user.id}
        `;
      }
      console.log(`  renamed ${seedUsers.length} user emails to @${NEW_EMAIL_DOMAIN}`);

      // 6. Delete the old tenant row. Anything keyed on it via FK
      //    that we didn't update is now orphaned — but if step 3+4
      //    were exhaustive, there's nothing to orphan. CASCADE on
      //    core_tenant_apps + core_tenant_domains handles those.
      await tx`DELETE FROM core_tenants WHERE id = ${source.id}`;
      console.log(`  deleted source tenant ${source.slug}`);
    });

    // ── Verify ─────────────────────────────────────────────────────
    const finalTenants = await sql<
      { slug: string; name: string }[]
    >`SELECT slug, name FROM core_tenants`;
    console.log("\nFinal tenant list:", finalTenants);

    const demoEvents = await sql<{ n: string }[]>`
      SELECT COUNT(*) as n FROM cem_events
    `;
    console.log(`Total events now: ${demoEvents[0].n} (should match source's 25).`);

    console.log("\n✅ Migration complete.");
  } catch (e) {
    console.error("\n❌ Migration failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();
