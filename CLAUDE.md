# CLAUDE.md — Church Event Management System

> **Read this file at the start of every session. It is the source of truth.**
> Reference (local only — `src/` is in `.gitignore`, never pushed to the repo):
> - `src/PRD-Church-Event-Management-v4.md` (Section 14 = build plan)
> - `src/SECURITY_CHECKLIST.md`
> - `src/SECURITY_TEST.md`
> - `src/church-events-prototype.jsx` (visual reference)
>
> If a future session is missing `src/`, ask the user to restore those files before proceeding.

---

## Project State
- **Current Phase:** 1 (Foundation)
- **Current Feature:** F03 — Authentication (next up)
- **Last Updated:** 2026-05-08
- **Last Session Summary:** F02 (Tenant Middleware) shipped. Subdomain + custom-domain resolution, header injection (`x-tenant-id`, `x-tenant-slug`, `x-domain-type`), reserved-subdomain allowlist, header-spoof sanitisation. Bumped Next.js to 15.5.18 to enable typed `runtime: "nodejs"` middleware. End-to-end verified against 6 host scenarios. Security audit: 0 Critical, 0 High.
- **Deployment Path:** Option A — Supabase + Vercel (Supabase Postgres in eu-central-1/Frankfurt for GDPR, Supabase Auth, Supabase Storage, Vercel hosting). See Architecture Decision #1.

---

## Completed Features

<!-- Move features here when done. Include the date and any notes. Do NOT remove entries. -->

| ID  | Feature        | Completed  | Security Passed | Notes |
|-----|----------------|------------|-----------------|-------|
| F01 | Database + ORM | 2026-05-07 | ✅ Yes (0 C / 0 H) | 16 tables on Supabase eu-central-1. Seed verified: 25 events, 21 holidays, 7 requests, 15 birthdays, 6 unmapped, 18 users, 6 departments, 1 tenant + app. See `SECURITY_TEST_REPORT.md`. |
| F02 | Tenant Middleware | 2026-05-08 | ✅ Yes (0 C / 0 H) | `lib/tenant.ts` (3 cached lookup helpers), `lib/auth/access.ts` (`checkAccess`), `middleware.ts` (subdomain + custom-domain resolution + header sanitisation). Bumped Next to 15.5.18 for typed Node middleware runtime. End-to-end tested against 6 host scenarios. RLS policies deferred to F03 per Known Issue #2. |

---

## In Progress

<!-- Only ONE feature at a time. -->

| ID | Feature | Status | Blockers |
|----|---------|--------|----------|
| –  | –       | (idle — F02 complete; F03 not yet started) | – |

---

## Pending Features

<!-- Ordered by priority. Build features in this order. Do not reorder without explicit instruction. -->

| ID  | Feature                          | Phase | Dependencies     |
|-----|----------------------------------|-------|------------------|
| F03 | Authentication                   | 1     | F01 ✅, F02 ✅   |
| F04 | Design System (Shadcn + Cal.com) | 1     | None (parallel)  |
| F05 | Navigation Bar                   | 2     | F03, F04         |
| F06 | Calendar — List View             | 2     | F04, F05         |
| F07 | Calendar — Month Grid View       | 2     | F06              |
| F08 | Departments Page                 | 2     | F05              |
| F09 | Holidays Page                    | 2     | F06              |
| F10 | Birthdays — Public View          | 3     | F05, F06         |
| F11 | Birthday Self-Service            | 3     | F10              |
| F12 | Unmapped Birthday Pool           | 3     | F10              |
| F13 | StatsRow Component               | 4     | F04              |
| F14 | Lead Dashboard                   | 4     | F13, F03         |
| F15 | Admin Dashboard                  | 4     | F13, F14         |
| F16 | Super Admin Dashboard            | 4     | F13, F15         |
| F17 | Notification System              | 5     | F15, F16         |
| F18 | Audit Log                        | 5     | F15, F16         |
| F19 | Toast System                     | 5     | F04              |
| F20 | Custom Domain Management         | 6     | F02              |
| F21 | Tenant App Launcher              | 6     | F02, F03         |

### Acceptance + Security Checkpoint per Feature

**F01: Database + ORM**
- Build: Drizzle config, all `core_` tables (Section 3), all `cem_` tables (Section 11), migration scripts, seed script (Section 15).
- Acceptance: `drizzle-kit push` runs without errors. Seed populates all tables. Query for events returns 25 rows.
- Security: No hardcoded connection strings. `.env` contains `DATABASE_URL`. `.env` in `.gitignore`. SSL required for DB connection.

**F02: Tenant Middleware**
- Build: Subdomain resolution, custom domain lookup, tenant context injection via headers, `lib/tenant.ts` helpers.
- Acceptance: `newsong.churchplatform.com` resolves to correct tenant. Unknown subdomain redirects. Custom domain lookup works when `core_tenant_domains` has a verified row.
- Security: No tenant data leakage across subdomains. Middleware rejects unrecognised domains. No open redirects.

**F03: Authentication**
- Build: Login page, session management, `checkAccess()`, role resolution, logout, protected route middleware.
- Acceptance: Valid login creates session with `userId, tenantId, role, appSlug`. Protected routes 401 unauthenticated. Role checks enforced. Platform admin bypasses role checks.
- Security: bcrypt ≥12 rounds. No plaintext passwords. Tokens in httpOnly cookies only (never localStorage). Failed login lockout after 5. Session timeout configured. CSRF tokens on state-changing requests.

**F04: Design System (Shadcn + Cal.com)**
- Build: Shadcn install, Cal.com token overrides (Section 6), Cal Sans + Inter fonts, dark mode CSS variables, global styles, Tailwind config.
- Acceptance: All color tokens match Section 6 exactly. Cal Sans for headings, Inter for body. Dark mode toggles all tokens. No default Shadcn blue anywhere.
- Security: No external font loading from untrusted CDNs. CSP allows font sources.

**F05: Navigation Bar**
- Build: NavBar component (Section 9), all nav links, role-conditional Dashboard link, dark mode toggle, login/logout buttons, notification bell placeholder, user name + role badge.
- Acceptance: Matches prototype exactly. Dashboard link first for Lead/Admin/Super. Logo navigates to Calendar. Login button when not authenticated. Role badge correct colors.
- Security: No role info leaked in client-side HTML for unauthenticated users. Logout clears session completely.

**F06: Calendar — List View**
- Build: CalendarScreen with List default, events grouped by month (FR-1), EventRow, past events collapsed stack, search, type filter chips, department dropdown.
- Acceptance: 25 events render across 12 months. Headers `JANUARY | 5 EVENTS`. Past events collapse. Search filters by title. Type chips toggle. Color bars match types.
- Security: No SQL injection via search. Parameterized queries. Input sanitized before render.

**F07: Calendar — Month Grid View**
- Build: 7-column grid, prev/next/today nav, event chips on day cells, Event Detail Modal.
- Acceptance: Sun-Sat columns. Events as colored chips on correct dates. Chip click opens modal. Prev-month overflow days dimmed.
- Security: Event detail does not expose internal IDs or sensitive data to unauthorised users.

**F08: Departments Page**
- Build: DepartmentsScreen (FR-2), department cards, auth-gated contact details, login prompt banner.
- Acceptance: 6 departments. Unauthenticated → names + leads only, contacts hidden. Authenticated → full contacts.
- Security: `/api/departments` does NOT return email/phone for unauthenticated requests. Auth check is server-side.

**F09: Holidays Page**
- Build: HolidaysScreen (FR-3), 21 Berlin 2026 dates, three type chips, past holiday stack, Plan button for admin+.
- Acceptance: 21 holidays chronological. Chips toggle. Past collapse. Plan visible only to admin/superadmin. Plan opens event creation pre-filled with holiday date.
- Security: Plan button rendering role-checked server-side. Endpoint must verify role independently of UI.

**F10: Birthdays — Public View**
- Build: BirthdaysScreen (FR-4), current month full-width with "THIS MONTH" badge, fluid card grid (flex 1 1 260px, max 340px), BirthdayRow, landmark tags blue/green, past months 55% opacity.
- Acceptance: Current month at top. Other months as fluid cards. Landmark tags say "Landmark" for opted-in (no age). Color tiers: blue 10-40, green 50-90. Year NEVER displayed for other users.
- Security: `/api/birthdays` NEVER returns `year`. Landmark calculation is server-side. Response carries `isLandmark` and `landmarkColor`, not raw year.

**F11: Birthday Self-Service**
- Build: Own birthday display, edit mode (day/month/year dropdowns), "Show my age" checkbox, `/api/me/birthday`.
- Acceptance: Logged-in user sees own birthday with year. Edit expands inline. Save updates DB + toast. "Show my age" persists. Default off.
- Security: PUT `/api/me/birthday` validates `userId` from session, not body. Validate day 1-31, month 1-12, year 1900-current.

**F12: Unmapped Birthday Pool**
- Build: Admin collapsible section, fluid cards, fuzzy name matching (`lib/birthdays/fuzzy-match.ts`), Map/Dismiss actions, live count.
- Acceptance: Admin sees amber banner with count. Expanding shows fluid cards. Suggested matches in blue. Map confirms; Dismiss removes. Non-admin never see this section.
- Security: Endpoints require admin role. Audit log entry on each map/dismiss.

**F13: StatsRow Component**
- Build: Single bordered container with vertical dividers, number + label inline, optional sub-label.
- Acceptance: Equal-width cells in one container. Number 28px/400, label 11px/400 beside it, sub 10px/500 below. Clickable: pointer cursor + hover bg.
- Security: N/A (pure UI).

**F14: Lead Dashboard**
- Build: LeadDashboard (FR-5), StatsRow (4 stats), request table, View (eye) and Edit (drafts only) actions, CreateForm modal (new + edit modes).
- Acceptance: Table shows own requests. Eye opens detail. Edit on drafts opens prefilled form. Save Draft, Update Draft, Submit all toast.
- Security: `/api/requests` scoped to authenticated Lead's requests only. Edit only on own drafts. Submit changes status server-side.

**F15: Admin Dashboard**
- Build: AdminDashboard (FR-6), StatsRow (5), 4-tab queue (New/Under Review/Forwarded/Returned), Claim, Forward, Return (FeedbackModal), live transitions.
- Acceptance: Claim moves New → Under Review with toast. Forward → Forwarded. Return opens modal → Returned with feedback saved. Tab counts update live. Audit logged.
- Security: Cannot claim already-claimed (check `claimed_by`). Forward/Return only on own claims. Status transitions enforced server-side. Feedback sanitized.

**F16: Super Admin Dashboard**
- Build: SuperAdminDashboard (FR-7), StatsRow (4 clickable), tabbed view, Approve / Edit-Approve / Send-Back / Delete.
- Acceptance: Approve creates published event from request and notifies all. Edit-Approve modifies before publishing. Send Back returns to Admin queue. Delete is permanent. All actions logged.
- Security: Super Admin role verified on every endpoint. Delete creates audit log entry with metadata. Published events go through same validation as request creation.

**F17: Notification System**
- Build: Bell dropdown (FR-8), unread count, list, read/mute, notifications on every state transition.
- Acceptance: State transitions trigger notifications to correct recipients. Bell shows unread count. Read/mute work. Muted at 50% opacity.
- Security: Notifications scoped to authenticated user. No reading others'. No sensitive data in body visible to wrong roles.

**F18: Audit Log**
- Build: Writes on every state transition, Super Admin viewer.
- Acceptance: Every request state change, birthday map/dismiss, event publish creates an entry. Entries immutable. Super Admin can view + filter.
- Security: `cem_audit_log` allows INSERT only. No UPDATE, no DELETE. Enforce at DB level.

**F19: Toast System**
- Build: Global toast component, auto-dismiss 3s, success/error variants.
- Acceptance: `showToast()` works. Auto-dismiss. No stacking (latest replaces). `role="alert"`.
- Security: Toast content never raw user input. Predefined message templates only.

**F20: Custom Domain Management**
- Build: Domain UI in tenant settings, DNS verification cron, Vercel API (Supabase path) or Traefik (Hetzner path).
- Acceptance: Admin can add domain. Shows DNS instructions. Verify checks DNS. Status: pending → dns_verified → active. Primary toggle enables subdomain redirect.
- Security: Verification needs both CNAME and TXT match. No open redirects via primary domain. Rate-limit verification attempts.

**F21: Tenant App Launcher**
- Build: Tenant home (`/{tenant}/page.tsx`) showing enabled apps as cards, app access check in each solution's layout.
- Acceptance: Home shows only apps in `core_tenant_apps`. Disabled apps show "not available", not 404. Each app checks access on mount.
- Security: App visibility is server-rendered. Client JS cannot reveal disabled app routes. `core_tenant_apps` check is in server component or middleware.

---

## Architecture Decisions

<!-- Log decisions made during the build that deviate from or clarify the PRD. -->

1. **2026-05-07 — Switched to PRD Option A (Supabase + Vercel) instead of Option B (Hetzner + Coolify).**
   The PRD explicitly supports both: *"Two supported deployment paths. Both use the same application code."* (Section 4). User chose Supabase during F01 setup. Implications:
   - **DB driver:** `postgres-js` (Supabase recommended) instead of `node-postgres`. SSL set to `"require"` in `db/index.ts`.
   - **Two connection strings:** `DATABASE_URL` for runtime (will be the pooled port 6543 URL in production), `DIRECT_URL` for `drizzle-kit` migrations (port 5432, required for DDL). In dev both currently point to the direct connection.
   - **F03 Authentication:** will use Supabase Auth (email + magic link + OAuth) instead of custom bcrypt + cookie-session. The PRD's bcrypt rule still applies to any custom auth surface (e.g. legacy passwords) but Supabase manages session tokens via secure HTTP-only cookies natively.
   - **Tenant isolation:** Add Supabase RLS policies as a second layer on top of the application-level `WHERE tenant_id = ?` checks (PRD Section 16, rule 3). Deferred to F02.
   - **F20 Custom domains:** use Vercel Domains API (already documented in PRD Section 3, "Supabase + Vercel" sub-block) instead of Traefik.
   - **Region:** Supabase project provisioned in `eu-central-1` (Frankfurt) for GDPR compliance (SECURITY_CHECKLIST Phase 1).

2. **2026-05-07 — Holiday type classification follows the prototype, not the PRD's count breakdown.**
   PRD Section 15 says *"21 holidays (Berlin 2026: 10 public, 6 church, 5 special)"*. The prototype's `HOLIDAYS` array, which Section 15 also instructs us to use as seed data verbatim, classifies them as 10 public / 8 church / 3 special. The two data points conflict. I followed the prototype because it's the canonical visual reference and because the type counts are not load-bearing for any feature — only the names and dates are. If we later decide the PRD's split is correct, we'll move 2 holidays from `church` to `special` (Reformation Day and 1st Advent are the most defensible moves: neither is a Berlin holy-day-of-obligation). Tracked in Known Issues.

---

## Known Issues

<!-- Track bugs or incomplete items discovered during development. -->

1. **Holiday type counts (10/8/3) deviate from PRD Section 15 (10/6/5).** Following prototype data per Architecture Decision #2. Resolution path documented there. Severity: low — does not affect any feature.

2. **Supabase RLS policies for tenant isolation deferred to F03.** ADR #1 originally said RLS would be added in F02. On reflection, RLS policies that reference `auth.uid()` are most useful once Supabase Auth is wiring up that JWT claim — which doesn't happen until F03. Application-level tenant scoping (every `cem_*` query includes `WHERE tenant_id = ?`) remains the primary control until then; RLS becomes the second layer. Severity: medium — application-level scoping is sufficient for correctness, but defense-in-depth is reduced until F03 ships.

---

## Security Audit Log

<!-- After each feature, record the security test result. Append rows; never remove. -->

| Feature | Date       | Critical | High | Medium | Low | Status                                             |
|---------|------------|----------|------|--------|-----|----------------------------------------------------|
| F01     | 2026-05-07 | 0        | 0    | 6      | 1   | ✅ PASS — 1 High found and fixed (drizzle-orm SQLi → bumped to ^0.45.2). 6 Medium are transitive npm-audit dev-time issues with no upstream fix; documented in `SECURITY_TEST_REPORT.md`. 1 Low is the demo seed password (acceptable per file header). |
| F02     | 2026-05-08 | 0        | 0    | 6      | 0   | ✅ PASS — Zero new findings. Defense-in-depth additions: header-spoof sanitisation, UUID shape validation, reserved-subdomain allowlist, 308 canonical-host redirect. 6 Medium npm-audit findings carry over from F01 (unchanged). End-to-end verified against 6 host scenarios. |

---

## Operating Rules

1. Read this file at the start of every session.
2. Never work on a feature not listed in **In Progress**.
3. When starting a feature, move it from **Pending** to **In Progress**.
4. When finishing (and security passes), move it to **Completed**.
5. If a session ends mid-feature, update Status with exactly where you stopped.
6. Never remove entries from **Completed** or **Security Audit Log**.
7. Bugs in completed features go into **Known Issues**, not back into In Progress.
8. After every feature: run `src/SECURITY_TEST.md` against changed files, log results, fix all Critical/High before marking complete.

### Key Security Rules (always enforced)

1. No hardcoded secrets. `.env` only. `.env` in `.gitignore`.
2. Parameterized queries only (Drizzle by default; verify any raw SQL).
3. `userId` from session, never request body.
4. Every `cem_` query includes `WHERE tenant_id = ?`.
5. Role checks server-side. Client-side hiding is cosmetic only.
6. **Birthday `year` never leaked.** Public/authenticated list endpoints never return it. Only `/api/me/birthday` (own) and admin endpoints with `?admin=true`.
7. `cem_audit_log` is INSERT only. No UPDATE, no DELETE. Enforced at DB.
8. Rate limit auth: login 5/15min, signup 3/hr, password reset 3/hr.
9. Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP.
10. httpOnly cookies for session tokens. Never localStorage, never sessionStorage.
