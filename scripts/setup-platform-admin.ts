// One-shot platform-admin setup.
//
// Creates the first platform admin (`is_platform_admin = true`) and
// optionally adds them as a super-admin member of the demo tenant.
//
// SECURITY:
// - Refuses to run if a platform admin already exists. Re-running this
//   script accidentally must NEVER promote a different account.
// - Refuses to run if PLATFORM_ADMIN_PASSWORD env var is missing.
// - Uses Supabase Admin API (service-role key) to create the auth
//   user. The auth user's UUID is then re-used as the core_users.id
//   so getSession() can resolve the same identity end-to-end.
// - email_verified=true on the Supabase auth user so you can log in
//   immediately without an email-confirm round-trip.
//
// Run:
//   PLATFORM_ADMIN_PASSWORD='<paste from password manager>' \
//     npx tsx --env-file=.env scripts/setup-platform-admin.ts
//
// After it succeeds, UNSET PLATFORM_ADMIN_PASSWORD from your shell
// (it should never live in your shell history or env files).

import "dotenv/config";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "me@otobong.com";
const ADMIN_NAME = "Otobong Okoko";
const DEMO_TENANT_SLUG = "demo";

(async () => {
  // ── Pre-flight ───────────────────────────────────────────────────
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    console.error(
      "PLATFORM_ADMIN_PASSWORD env var missing or too short (<12 chars). Aborting.",
    );
    process.exit(1);
  }

  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl) {
    console.error("DATABASE_URL or DIRECT_URL not set. Aborting.");
    process.exit(1);
  }
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Aborting.",
    );
    process.exit(1);
  }

  const sql = postgres(dbUrl);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Refuse if any platform admin already exists.
    const existingAdmin = await sql<{ id: string; email: string }[]>`
      SELECT id, email FROM core_users WHERE is_platform_admin = true LIMIT 1
    `;
    if (existingAdmin.length > 0) {
      console.error(
        `Platform already initialised — admin exists: ${existingAdmin[0].email}. Aborting.`,
      );
      process.exit(1);
    }

    // 2. Refuse if a core_users row with this email already exists
    //    (avoids accidentally promoting an existing user without
    //     intending to — a separate "promote" action would be safer
    //     for that case).
    const existingByEmail = await sql<{ id: string }[]>`
      SELECT id FROM core_users WHERE email = ${ADMIN_EMAIL} LIMIT 1
    `;
    if (existingByEmail.length > 0) {
      console.error(
        `A user with email ${ADMIN_EMAIL} already exists in core_users. Refusing to overwrite. Aborting.`,
      );
      process.exit(1);
    }

    // 3. Confirm the demo tenant exists (we'll add membership to it).
    const demoTenant = await sql<{ id: string }[]>`
      SELECT id FROM core_tenants WHERE slug = ${DEMO_TENANT_SLUG} LIMIT 1
    `;
    if (demoTenant.length === 0) {
      console.error(
        `Demo tenant (slug='${DEMO_TENANT_SLUG}') not found. Run the seed-to-demo migration first. Aborting.`,
      );
      process.exit(1);
    }
    const demoTenantId = demoTenant[0].id;

    // 4. Find the CEM app id (for the role row).
    const cemApp = await sql<{ id: string }[]>`
      SELECT id FROM core_apps WHERE slug = 'cem' LIMIT 1
    `;
    if (cemApp.length === 0) {
      console.error("core_apps row for slug='cem' not found. Aborting.");
      process.exit(1);
    }
    const cemAppId = cemApp[0].id;

    // ── Create the Supabase auth user ───────────────────────────────
    // We use the admin API directly. email_confirm: true means the
    // user can log in immediately (no email-link round-trip).
    console.log(`Creating Supabase auth user for ${ADMIN_EMAIL}...`);
    const { data: authData, error: authErr } =
      await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { name: ADMIN_NAME },
      });
    if (authErr || !authData.user) {
      console.error(
        "Supabase auth user creation failed:",
        authErr?.message ?? "unknown error",
      );
      process.exit(1);
    }
    const userId = authData.user.id;
    console.log(`  auth user created: ${userId}`);

    // ── Insert core_users + tenant membership in one transaction ───
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO core_users (
          id, email, name, is_platform_admin, email_verified
        ) VALUES (
          ${userId}, ${ADMIN_EMAIL}, ${ADMIN_NAME}, true, true
        )
      `;
      console.log(`  core_users row inserted`);

      // Membership on demo (active).
      await tx`
        INSERT INTO core_tenant_users (tenant_id, user_id, status)
        VALUES (${demoTenantId}, ${userId}, 'active')
      `;
      console.log(`  core_tenant_users membership added (demo)`);

      // Super-admin role on demo's CEM app.
      await tx`
        INSERT INTO core_tenant_user_roles (
          tenant_id, user_id, app_id, role
        ) VALUES (
          ${demoTenantId}, ${userId}, ${cemAppId}, 'superadmin'
        )
      `;
      console.log(`  core_tenant_user_roles superadmin role added (demo, cem)`);
    });

    console.log("\n✅ Platform admin created.");
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Tenant access: demo (super-admin) + platform-admin bypass everywhere`);
    console.log("\nNext: unset PLATFORM_ADMIN_PASSWORD from your shell so it doesn't linger.");
  } catch (e) {
    console.error("\n❌ Setup failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();
