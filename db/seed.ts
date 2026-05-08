// Seed script — populates the dev database with the prototype's sample
// data (PRD Section 15). Idempotent: safe to run repeatedly. Truncates
// the CEM tables and core demo rows before re-inserting.
//
// Run with: `npm run db:seed`
//
// SECURITY:
// - Demo passwords use bcrypt hashes (rule from F03 checkpoint, applied
//   here so seeded accounts are immediately usable for F03 testing).
//   bcrypt cost = 12 (PRD Section 16, rule 6).
// - Plaintext demo passwords appear ONLY in the comment block below for
//   the developer to know how to log in. They are not committed to any
//   user-facing string in the codebase.
//
// Demo logins (all use the password `Password123!`):
//   - john.doe@church.com         → member
//   - otobong.okoko@church.com    → lead
//   - admin.sarah@church.com      → admin
//   - pastor.james@church.com     → superadmin (also platform admin)

// Load .env BEFORE importing ./index, because db/index.ts reads
// process.env.DATABASE_URL at module-init time.
import { config } from "dotenv";
config({ path: ".env" });

// eslint-disable-next-line import/first
import { sql } from "drizzle-orm";
// eslint-disable-next-line import/first
import bcrypt from "bcryptjs";
// eslint-disable-next-line import/first
import { db } from "./index";
// eslint-disable-next-line import/first
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import {
  coreApps,
  coreTenantApps,
  coreTenantUserRoles,
  coreTenantUsers,
  coreTenants,
  coreUsers,
  cemBirthdays,
  cemBirthdaysUnmapped,
  cemDepartments,
  cemEvents,
  cemHolidays,
  cemRequests,
} from "./schema";

const DEMO_PASSWORD = "Password123!";

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function truncate() {
  // Order matters because of FKs.
  await db.execute(sql`TRUNCATE
    cem_audit_log,
    cem_notifications,
    cem_birthdays_unmapped,
    cem_birthdays,
    cem_request_feedback,
    cem_requests,
    cem_events,
    cem_holidays,
    cem_departments,
    core_tenant_user_roles,
    core_tenant_users,
    core_tenant_apps,
    core_tenant_domains,
    core_apps,
    core_users,
    core_tenants
    CASCADE`);
}

async function main() {
  console.log("Seeding database...");

  await truncate();

  // ── Tenant + App ────────────────────────────────────────────────────
  const [tenant] = await db
    .insert(coreTenants)
    .values({
      name: "New Song Parish Berlin",
      slug: "newsong",
      timezone: "Europe/Berlin",
      status: "active",
    })
    .returning();

  const [app] = await db
    .insert(coreApps)
    .values({
      slug: "cem",
      name: "Church Event Management",
      description: "Plan, approve and publish church events.",
      status: "active",
    })
    .returning();

  await db.insert(coreTenantApps).values({
    tenant_id: tenant.id,
    app_id: app.id,
    enabled: true,
  });

  // ── Users ───────────────────────────────────────────────────────────
  //
  // If SUPABASE_SERVICE_ROLE_KEY is set, we create the demo users in
  // Supabase Auth first and use the auth.users.id as core_users.id.
  // This ties the application user record to the auth identity.
  //
  // If the key is not set, we fall back to plain core_users rows with
  // bcrypt password hashes — useful for offline DB testing but the
  // demo accounts won't be loginable until you run the seed again with
  // the service-role key.
  const useSupabaseAuth = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const passwordHash = await hash(DEMO_PASSWORD);

  type DemoUser = {
    email: string;
    name: string;
    is_platform_admin: boolean;
  };
  const demoUsers: DemoUser[] = [
    { email: "john.doe@church.com", name: "John Doe", is_platform_admin: false },
    { email: "otobong.okoko@church.com", name: "Otobong Okoko", is_platform_admin: false },
    { email: "admin.sarah@church.com", name: "Admin Sarah", is_platform_admin: false },
    { email: "pastor.james@church.com", name: "Pastor James", is_platform_admin: true },
  ];

  let demoUserIds: Record<string, string>; // email → core_users.id

  if (useSupabaseAuth) {
    console.log("Creating demo users via Supabase Auth admin API...");
    const admin = createSupabaseAdminClient();
    demoUserIds = {};
    for (const u of demoUsers) {
      // Idempotency: if a user with this email already exists in
      // Supabase Auth (e.g. from a previous run), reuse their id.
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users.find((au) => au.email?.toLowerCase() === u.email.toLowerCase());

      let authId: string;
      if (existing) {
        authId = existing.id;
        // Refresh password so DEMO_PASSWORD always works after re-seed.
        await admin.auth.admin.updateUserById(authId, {
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { name: u.name },
        });
      } else {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: u.email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { name: u.name },
        });
        if (error || !created.user) {
          throw new Error(
            `Failed to create Supabase Auth user ${u.email}: ${error?.message ?? "unknown error"}`,
          );
        }
        authId = created.user.id;
      }
      demoUserIds[u.email] = authId;
    }
  } else {
    console.log(
      "SUPABASE_SERVICE_ROLE_KEY not set — creating core_users with random ids and bcrypt hashes.",
    );
    console.log(
      "  (Demo logins won't work via Supabase Auth until you re-run the seed with the key.)",
    );
    // Random UUIDs, generated by the database when we INSERT (defaultRandom).
    demoUserIds = {};
  }

  const [john, otobong, sarah, james] = await db
    .insert(coreUsers)
    .values(
      demoUsers.map((u) => ({
        // When using Supabase Auth, force the core_users.id to match
        // the auth.users.id. Otherwise let the DB generate a UUID.
        ...(useSupabaseAuth ? { id: demoUserIds[u.email] } : {}),
        email: u.email,
        name: u.name,
        // Only store bcrypt hash when Supabase Auth isn't managing
        // passwords. With Supabase Auth, this column stays null.
        password_hash: useSupabaseAuth ? null : passwordHash,
        is_platform_admin: u.is_platform_admin,
        email_verified: true,
      })),
    )
    .returning();

  await db.insert(coreTenantUsers).values([
    { tenant_id: tenant.id, user_id: john.id, status: "active" },
    { tenant_id: tenant.id, user_id: otobong.id, status: "active" },
    { tenant_id: tenant.id, user_id: sarah.id, status: "active" },
    { tenant_id: tenant.id, user_id: james.id, status: "active" },
  ]);

  await db.insert(coreTenantUserRoles).values([
    { tenant_id: tenant.id, user_id: john.id, app_id: app.id, role: "member" },
    { tenant_id: tenant.id, user_id: otobong.id, app_id: app.id, role: "lead" },
    { tenant_id: tenant.id, user_id: sarah.id, app_id: app.id, role: "admin" },
    { tenant_id: tenant.id, user_id: james.id, app_id: app.id, role: "superadmin" },
  ]);

  // ── Departments ─────────────────────────────────────────────────────
  // Prototype: 6 departments. Otobong leads Youth Ministry; the others
  // have named non-user leads (kept as text-only contact info; lead_user_id
  // null for those).
  const deptRows = await db
    .insert(cemDepartments)
    .values([
      {
        tenant_id: tenant.id,
        name: "Youth Ministry",
        icon: "👥",
        lead_user_id: otobong.id,
        email: "otobong.okoko@church.com",
        phone: "+49 176 123 4567",
      },
      {
        tenant_id: tenant.id,
        name: "Women's Fellowship",
        icon: "💜",
        email: "mary.johnson@church.com",
        phone: "+49 176 234 5678",
      },
      {
        tenant_id: tenant.id,
        name: "Worship Team",
        icon: "🎵",
        email: "john.emmanuel@church.com",
        phone: "+49 176 345 6789",
      },
      {
        tenant_id: tenant.id,
        name: "Community Outreach",
        icon: "🌍",
        email: "david.thompson@church.com",
        phone: "+49 176 456 7890",
      },
      {
        tenant_id: tenant.id,
        name: "Prayer Team",
        icon: "📖",
        email: "grace.obi@church.com",
        phone: "+49 176 567 8901",
      },
      {
        tenant_id: tenant.id,
        name: "Senior Ministry",
        icon: "🤝",
        email: "peter.adeyemi@church.com",
        phone: "+49 176 678 9012",
      },
    ])
    .returning();

  const deptByName = new Map(deptRows.map((d) => [d.name, d.id]));

  // ── Events (25) ─────────────────────────────────────────────────────
  // Verbatim from prototype EVENTS array.
  const eventSeed: Array<{
    title: string;
    type: "sunday" | "regional" | "local";
    date: string;
    time: string;
    location: string;
    dept: string;
    description: string;
    attendance: number;
  }> = [
    { title: "New Year Celebration", type: "local", date: "2026-01-01", time: "3:00 PM - 8:00 PM", location: "Fellowship Hall", dept: "Youth Ministry", description: "Ring in the new year with worship, food, and fellowship for the whole church family.", attendance: 150 },
    { title: "Sunday Service", type: "sunday", date: "2026-01-04", time: "10:00 AM - 12:00 PM", location: "Main Sanctuary", dept: "Worship Team", description: "Weekly Sunday worship service with praise, prayer, and the Word.", attendance: 300 },
    { title: "Youth Conference 2026", type: "local", date: "2026-01-15", time: "3:00 PM - 8:00 PM", location: "Fellowship Hall", dept: "Youth Ministry", description: "Annual youth conference featuring guest speakers, workshops, and worship sessions.", attendance: 200 },
    { title: "Regional Leadership Meeting", type: "regional", date: "2026-01-21", time: "6:00 PM - 9:00 PM", location: "Conference Room", dept: "Community Outreach", description: "Quarterly meeting for regional church leaders to align on strategy and share updates.", attendance: 45 },
    { title: "Women's Fellowship Retreat", type: "local", date: "2026-01-28", time: "9:00 AM - 4:00 PM", location: "Retreat Center", dept: "Women's Fellowship", description: "A day of spiritual renewal, sisterhood, and rest.", attendance: 60 },
    { title: "Valentine's Couples Dinner", type: "local", date: "2026-02-14", time: "6:00 PM - 9:00 PM", location: "Fellowship Hall", dept: "Women's Fellowship", description: "An evening of celebration for couples in the church community.", attendance: 80 },
    { title: "Prayer & Fasting Week", type: "sunday", date: "2026-02-22", time: "6:00 AM - 6:00 PM", location: "Main Sanctuary", dept: "Prayer Team", description: "Week-long prayer and fasting programme.", attendance: 120 },
    { title: "Community Outreach Day", type: "local", date: "2026-03-07", time: "9:00 AM - 5:00 PM", location: "Community Center", dept: "Community Outreach", description: "A day of service reaching out to the local community.", attendance: 200 },
    { title: "Senior Ministry Lunch", type: "local", date: "2026-03-18", time: "12:00 PM - 3:00 PM", location: "Fellowship Hall", dept: "Senior Ministry", description: "Monthly fellowship lunch for senior members.", attendance: 40 },
    { title: "Easter Musical Night", type: "regional", date: "2026-04-03", time: "5:00 PM - 9:00 PM", location: "Main Sanctuary", dept: "Worship Team", description: "Special Easter musical evening with choir performances.", attendance: 400 },
    { title: "Good Friday Service", type: "sunday", date: "2026-04-05", time: "10:00 AM - 1:00 PM", location: "Main Sanctuary", dept: "Worship Team", description: "Reflective Good Friday worship service.", attendance: 350 },
    { title: "Easter Sunday", type: "sunday", date: "2026-04-07", time: "8:00 AM - 12:00 PM", location: "Main Sanctuary", dept: "Worship Team", description: "Easter Sunday celebration service.", attendance: 500 },
    { title: "Mothers' Day Celebration", type: "local", date: "2026-05-10", time: "10:00 AM - 2:00 PM", location: "Fellowship Hall", dept: "Women's Fellowship", description: "Celebrating mothers in the congregation.", attendance: 250 },
    { title: "Regional Pastors' Conference", type: "regional", date: "2026-05-22", time: "9:00 AM - 5:00 PM", location: "Conference Room", dept: "Community Outreach", description: "Annual regional pastors' conference and networking.", attendance: 60 },
    { title: "Vacation Bible School", type: "local", date: "2026-06-15", time: "9:00 AM - 1:00 PM", location: "Fellowship Hall", dept: "Youth Ministry", description: "Week-long Bible school programme for children.", attendance: 100 },
    { title: "Fathers' Day Service", type: "sunday", date: "2026-06-21", time: "10:00 AM - 12:00 PM", location: "Main Sanctuary", dept: "Worship Team", description: "Special service honouring fathers.", attendance: 300 },
    { title: "Summer Youth Camp", type: "local", date: "2026-07-06", time: "All Day", location: "Camp Grounds", dept: "Youth Ministry", description: "Week-long summer camp for youth ages 12-18.", attendance: 80 },
    { title: "Back to School Service", type: "sunday", date: "2026-08-23", time: "10:00 AM - 12:00 PM", location: "Main Sanctuary", dept: "Worship Team", description: "Dedication and prayers for students returning to school.", attendance: 300 },
    { title: "Harvest Thanksgiving", type: "sunday", date: "2026-09-20", time: "10:00 AM - 2:00 PM", location: "Main Sanctuary", dept: "Worship Team", description: "Annual harvest thanksgiving celebration.", attendance: 350 },
    { title: "Regional Women's Conference", type: "regional", date: "2026-10-10", time: "9:00 AM - 5:00 PM", location: "Conference Room", dept: "Women's Fellowship", description: "Regional conference for women in ministry.", attendance: 150 },
    { title: "Community Health Fair", type: "local", date: "2026-11-07", time: "10:00 AM - 4:00 PM", location: "Community Center", dept: "Community Outreach", description: "Free health screenings and wellness information.", attendance: 200 },
    { title: "Thanksgiving Service", type: "sunday", date: "2026-11-22", time: "10:00 AM - 1:00 PM", location: "Main Sanctuary", dept: "Worship Team", description: "Special thanksgiving worship service.", attendance: 350 },
    { title: "Christmas Carol Night", type: "regional", date: "2026-12-12", time: "6:00 PM - 9:00 PM", location: "Main Sanctuary", dept: "Worship Team", description: "Evening of Christmas carols and performances.", attendance: 400 },
    { title: "Christmas Day Service", type: "sunday", date: "2026-12-25", time: "10:00 AM - 12:00 PM", location: "Main Sanctuary", dept: "Worship Team", description: "Christmas Day worship celebration.", attendance: 450 },
    { title: "Crossover Night Service", type: "sunday", date: "2026-12-31", time: "10:00 PM - 1:00 AM", location: "Main Sanctuary", dept: "Worship Team", description: "Year-end crossover night worship service.", attendance: 500 },
  ];

  await db.insert(cemEvents).values(
    eventSeed.map((e) => ({
      tenant_id: tenant.id,
      title: e.title,
      type: e.type,
      date: e.date,
      time: e.time,
      location: e.location,
      description: e.description,
      department_id: deptByName.get(e.dept) ?? null,
      expected_attendance: e.attendance,
      created_by: otobong.id,
    })),
  );

  // ── Holidays (21 — Berlin 2026) ─────────────────────────────────────
  const holidaySeed: Array<{
    date: string;
    name: string;
    type: "public" | "church" | "special";
    note: string;
  }> = [
    { date: "2026-01-01", name: "New Year's Day", type: "public", note: "Public holiday. Shops closed." },
    { date: "2026-02-18", name: "Ash Wednesday", type: "church", note: "Start of Lent, 40 days before Easter." },
    { date: "2026-03-08", name: "International Women's Day", type: "public", note: "Berlin public holiday. Falls on Sunday in 2026." },
    { date: "2026-03-29", name: "Palm Sunday", type: "church", note: "Sunday before Easter, start of Holy Week." },
    { date: "2026-04-02", name: "Maundy Thursday", type: "church", note: "Thursday before Easter. Last Supper commemoration." },
    { date: "2026-04-03", name: "Good Friday", type: "public", note: "Public holiday. Shops closed." },
    { date: "2026-04-05", name: "Easter Sunday", type: "church", note: "Resurrection of Christ." },
    { date: "2026-04-06", name: "Easter Monday", type: "public", note: "Public holiday. Shops closed." },
    { date: "2026-05-01", name: "Labour Day", type: "public", note: "Public holiday. Falls on Friday." },
    { date: "2026-05-10", name: "Mother's Day", type: "special", note: "2nd Sunday of May. Not a public holiday." },
    { date: "2026-05-14", name: "Ascension Day / Father's Day", type: "public", note: "Public holiday. Thursday, bridge day opportunity on Friday." },
    { date: "2026-05-24", name: "Whit Sunday (Pentecost)", type: "church", note: "Descent of the Holy Spirit." },
    { date: "2026-05-25", name: "Whit Monday", type: "public", note: "Public holiday. Monday after Pentecost." },
    { date: "2026-10-03", name: "German Unity Day", type: "public", note: "National Day. Falls on Saturday in 2026." },
    { date: "2026-10-31", name: "Reformation Day", type: "church", note: "Anniversary of Martin Luther's 95 Theses. Not a Berlin holiday." },
    { date: "2026-11-22", name: "Totensonntag", type: "church", note: "Protestant day of mourning. Sunday before Advent." },
    { date: "2026-11-29", name: "First Sunday of Advent", type: "church", note: "Start of the Advent season." },
    { date: "2026-12-24", name: "Christmas Eve", type: "special", note: "Not a public holiday, but shops close early." },
    { date: "2026-12-25", name: "Christmas Day", type: "public", note: "Public holiday. Shops closed." },
    { date: "2026-12-26", name: "2nd Christmas Day (St. Stephen's)", type: "public", note: "Public holiday. Falls on Saturday in 2026." },
    { date: "2026-12-31", name: "New Year's Eve", type: "special", note: "Not a public holiday. Crossover night services." },
  ];

  await db.insert(cemHolidays).values(
    holidaySeed.map((h) => ({
      tenant_id: tenant.id,
      date: h.date,
      name: h.name,
      type: h.type,
      note: h.note,
      year: 2026,
    })),
  );

  // ── Requests (7, various statuses) ──────────────────────────────────
  const now = new Date();
  await db.insert(cemRequests).values([
    {
      tenant_id: tenant.id,
      title: "Youth Conference 2026",
      type: "local",
      department_id: deptByName.get("Youth Ministry"),
      status: "submitted",
      submitted_by: otobong.id,
      submitted_at: new Date("2026-01-10T10:00:00Z"),
      created_at: new Date("2026-01-10T10:00:00Z"),
      updated_at: now,
    },
    {
      tenant_id: tenant.id,
      title: "Women's Fellowship Retreat",
      type: "local",
      department_id: deptByName.get("Women's Fellowship"),
      status: "under_review",
      submitted_by: otobong.id,
      claimed_by: sarah.id,
      submitted_at: new Date("2026-01-08T10:00:00Z"),
      claimed_at: new Date("2026-01-09T10:00:00Z"),
      updated_at: now,
    },
    {
      tenant_id: tenant.id,
      title: "Community Outreach Day",
      type: "local",
      department_id: deptByName.get("Community Outreach"),
      status: "ready_for_approval",
      submitted_by: otobong.id,
      claimed_by: sarah.id,
      submitted_at: new Date("2026-01-05T10:00:00Z"),
      claimed_at: new Date("2026-01-06T10:00:00Z"),
      forwarded_at: new Date("2026-01-07T10:00:00Z"),
      updated_at: now,
    },
    {
      tenant_id: tenant.id,
      title: "Easter Musical Night",
      type: "regional",
      department_id: deptByName.get("Worship Team"),
      status: "approved",
      submitted_by: otobong.id,
      claimed_by: sarah.id,
      approved_by: james.id,
      submitted_at: new Date("2026-01-03T10:00:00Z"),
      claimed_at: new Date("2026-01-04T10:00:00Z"),
      forwarded_at: new Date("2026-01-05T10:00:00Z"),
      approved_at: new Date("2026-01-06T10:00:00Z"),
      updated_at: now,
    },
    {
      tenant_id: tenant.id,
      title: "Prayer & Fasting Week",
      type: "sunday",
      department_id: deptByName.get("Prayer Team"),
      status: "submitted",
      submitted_by: otobong.id,
      submitted_at: new Date("2026-01-12T10:00:00Z"),
      updated_at: now,
    },
    {
      tenant_id: tenant.id,
      title: "Senior Fellowship Lunch",
      type: "local",
      department_id: deptByName.get("Senior Ministry"),
      status: "draft",
      submitted_by: otobong.id,
      updated_at: now,
    },
    {
      tenant_id: tenant.id,
      title: "Regional Pastors' Meeting",
      type: "regional",
      department_id: deptByName.get("Community Outreach"),
      status: "submitted",
      submitted_by: otobong.id,
      submitted_at: new Date("2026-01-11T10:00:00Z"),
      updated_at: now,
    },
  ]);

  // ── Birthdays (15 mapped) ───────────────────────────────────────────
  // The prototype's BIRTHDAYS_MAPPED has named users beyond the 4 demo
  // accounts — those don't exist in core_users. We only seed birthdays
  // for the 4 demo users plus a small set of additional users created
  // here so the page renders well. Schema requires a real user_id, so we
  // create 11 additional placeholder users for variety, mirroring the
  // prototype's mix of departments, ages, and showAge flags.
  const extraNames = [
    { name: "Sister Mary Johnson", email: "mary.johnson@example.com", day: 8, month: 5, year: 1976, dept: "Women's Fellowship", showAge: true },
    { name: "Pastor John Emmanuel", email: "john.emmanuel@example.com", day: 22, month: 7, year: 1966, dept: "Worship Team", showAge: false },
    { name: "Sister Grace Obi", email: "grace.obi@example.com", day: 1, month: 1, year: 1990, dept: "Prayer Team", showAge: false },
    { name: "Elder Peter Adeyemi", email: "peter.adeyemi@example.com", day: 30, month: 9, year: 1956, dept: "Senior Ministry", showAge: true },
    { name: "Chioma Eze", email: "chioma.eze@example.com", day: 14, month: 2, year: 1996, dept: "Youth Ministry", showAge: true },
    { name: "Brother David Thompson", email: "david.thompson@example.com", day: 19, month: 5, year: 1986, dept: "Community Outreach", showAge: false },
    { name: "Funke Adebayo", email: "funke.adebayo@example.com", day: 3, month: 6, year: 1976, dept: "Women's Fellowship", showAge: true },
    { name: "Samuel Okafor", email: "samuel.okafor@example.com", day: 25, month: 12, year: 2006, dept: "Youth Ministry", showAge: false },
    { name: "Deacon James Nwosu", email: "james.nwosu@example.com", day: 11, month: 8, year: 1966, dept: "Senior Ministry", showAge: true },
    { name: "Ruth Mensah", email: "ruth.mensah@example.com", day: 7, month: 5, year: 1996, dept: "Worship Team", showAge: false },
    { name: "Blessing Okoro", email: "blessing.okoro@example.com", day: 28, month: 11, year: 1986, dept: "Prayer Team", showAge: false },
    { name: "Michael Adeniyi", email: "michael.adeniyi@example.com", day: 16, month: 4, year: 2016, dept: "Youth Ministry", showAge: true },
    { name: "Agnes Balogun", email: "agnes.balogun@example.com", day: 5, month: 10, year: 1946, dept: "Senior Ministry", showAge: true },
    { name: "Tolu Akinwale", email: "tolu.akinwale@example.com", day: 20, month: 3, year: 1986, dept: "Community Outreach", showAge: false },
  ];

  const extraUsers = await db
    .insert(coreUsers)
    .values(
      extraNames.map((p) => ({
        email: p.email,
        name: p.name,
        password_hash: null, // these are display-only, not loginable
        email_verified: true,
      })),
    )
    .returning();

  await db.insert(coreTenantUsers).values(
    extraUsers.map((u) => ({ tenant_id: tenant.id, user_id: u.id, status: "active" })),
  );

  await db.insert(coreTenantUserRoles).values(
    extraUsers.map((u) => ({
      tenant_id: tenant.id,
      user_id: u.id,
      app_id: app.id,
      role: "member" as const,
    })),
  );

  // First mapped birthday is Otobong (the demo Lead user).
  await db.insert(cemBirthdays).values([
    {
      tenant_id: tenant.id,
      user_id: otobong.id,
      day: 15,
      month: 3,
      year: 1986,
      show_age: false,
      department_id: deptByName.get("Youth Ministry") ?? null,
    },
    ...extraNames.map((p, i) => ({
      tenant_id: tenant.id,
      user_id: extraUsers[i].id,
      day: p.day,
      month: p.month,
      year: p.year,
      show_age: p.showAge,
      department_id: deptByName.get(p.dept) ?? null,
    })),
  ]);

  // ── Unmapped birthday records (6: 3 with suggestions, 3 without) ────
  // Suggested matches reference existing extraUsers we just created.
  const findUserId = (name: string) => extraUsers.find((u) => u.name === name)?.id ?? null;

  await db.insert(cemBirthdaysUnmapped).values([
    {
      tenant_id: tenant.id,
      name: "Mary Johnson",
      day: 8,
      month: 5,
      year: 1976,
      suggest_match_user_id: findUserId("Sister Mary Johnson"),
      suggest_match_name: "Sister Mary Johnson",
      suggest_confidence: 92,
      status: "pending",
    },
    {
      tenant_id: tenant.id,
      name: "David T.",
      day: 19,
      month: 5,
      year: 1986,
      suggest_match_user_id: findUserId("Brother David Thompson"),
      suggest_match_name: "Brother David Thompson",
      suggest_confidence: 78,
      status: "pending",
    },
    {
      tenant_id: tenant.id,
      name: "Grace O.",
      day: 1,
      month: 1,
      year: 1990,
      suggest_match_user_id: findUserId("Sister Grace Obi"),
      suggest_match_name: "Sister Grace Obi",
      suggest_confidence: 85,
      status: "pending",
    },
    {
      tenant_id: tenant.id,
      name: "Kemi Bakare",
      day: 12,
      month: 6,
      year: 1988,
      status: "pending",
    },
    {
      tenant_id: tenant.id,
      name: "Chidi Okonkwo",
      day: 9,
      month: 9,
      year: 1995,
      status: "pending",
    },
    {
      tenant_id: tenant.id,
      name: "Folashade Ige",
      day: 23,
      month: 11,
      year: 1983,
      status: "pending",
    },
  ]);

  // ── Acceptance verification ─────────────────────────────────────────
  // PRD F01 acceptance: "Query for events returns 25 rows."
  const eventCount = await db.select({ count: sql<number>`count(*)::int` }).from(cemEvents);
  console.log(`✓ events: ${eventCount[0].count} (expected 25)`);
  if (eventCount[0].count !== 25) {
    throw new Error(`Seed verification failed: expected 25 events, got ${eventCount[0].count}`);
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
