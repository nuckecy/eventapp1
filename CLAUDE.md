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
- **Current Phase:** 2 (Public Pages — F07 next up)
- **Current Feature:** F07 — Calendar Month Grid View (next up)
- **Last Updated:** 2026-05-08
- **Last Session Summary:** F06 (Calendar List View) shipped. Server-side query helpers in lib/cem/events.ts (tenant-scoped, parameterized, with SQL LIKE meta-char escaping + 200-char search cap). EventRow / MonthSection / PastStack / FilterBar / ViewToggle / EmptyState components. Filter state lives in URL (?q, ?type, ?dept) for shareable links + back-button support. All 25 seed events render in the live HTML; search, type filter, department filter, empty state, past-stack accordion, and view toggle all working. Type-only `lib/cem/types.ts` extracted so client components can import shared types without pulling in server-only modules. Security audit: 0 Critical, 0 High.
- **Deployment Path:** Option A — Supabase + Vercel (Supabase Postgres in eu-central-1/Frankfurt for GDPR, Supabase Auth, Supabase Storage, Vercel hosting). See Architecture Decision #1.

---

## Completed Features

<!-- Move features here when done. Include the date and any notes. Do NOT remove entries. -->

| ID  | Feature        | Completed  | Security Passed | Notes |
|-----|----------------|------------|-----------------|-------|
| F01 | Database + ORM | 2026-05-07 | ✅ Yes (0 C / 0 H) | 16 tables on Supabase eu-central-1. Seed verified: 25 events, 21 holidays, 7 requests, 15 birthdays, 6 unmapped, 18 users, 6 departments, 1 tenant + app. See `SECURITY_TEST_REPORT.md`. |
| F02 | Tenant Middleware | 2026-05-08 | ✅ Yes (0 C / 0 H) | `lib/tenant.ts` (3 cached lookup helpers), `lib/auth/access.ts` (`checkAccess`), `middleware.ts` (subdomain + custom-domain resolution + header sanitisation). Bumped Next to 15.5.18 for typed Node middleware runtime. End-to-end tested against 6 host scenarios. RLS policies deferred to F03 per Known Issue #2. |
| F03 | Authentication | 2026-05-08 | ✅ Yes (0 C / 0 H) | Supabase Auth via `@supabase/ssr`. Login page (password + magic link), logout endpoint + action, /no-access page, `getSession()` + `requireAuth()` guards, middleware now refreshes Supabase cookies. RLS policies on all 16 tables (closes KI #2). `cem_audit_log` is INSERT-only at the DB level (closes part of F18's checkpoint early). End-to-end "log in as demo user" test pending `SUPABASE_SERVICE_ROLE_KEY` — all surrounding routes verified. |
| F04 | Design System (Shadcn + Cal.com) | 2026-05-08 | ✅ Yes (0 C / 0 H) | Tailwind CSS v4 with `@theme` registration of all PRD Section 6 tokens. Cal Sans + Inter via `next/font/google` (self-hosted, no CDN load at runtime). next-themes class-based dark mode + sun/moon toggle. CSP header added to next.config.ts (11 directives). Existing pages re-styled with Cal tokens. `/design-tokens` demo route renders every token in light + dark for visual QA. Cal Sans only ships weight 400 on Google Fonts; weights 500-600 fall back to synthesised — visually fine at display size, see Architecture Decision #3. |
| F05 | Navigation Bar | 2026-05-08 | ✅ Yes (0 C / 0 H) | Sticky 52px nav with logo, 4 always-on links + role-conditional Dashboard, theme toggle, role badge, notification bell placeholder, logout (form POST), Sign-in button for anon. Active state via usePathname (2px brand underline + weight 600). Built as server component → role decisions never reach the client bundle. Verified anon HTML leaks zero role hints. 7 CEM stub pages added so nav links resolve. Root redirects to /events. |
| F06 | Calendar — List View | 2026-05-08 | ✅ Yes (0 C / 0 H) | Tenant-scoped server query in `lib/cem/events.ts` with parameterized search (Drizzle `ilike`, LIKE meta-chars escaped, 200-char cap). EventRow / MonthSection / PastStack / FilterBar / ViewToggle / EmptyState. Filter state in URL (?q, ?type, ?dept) so views are shareable + back-button works. All 25 seed events confirmed in live HTML; type filter narrows correctly; empty state + view toggle stub for F07 working. Type-only `lib/cem/types.ts` lets client components import shared shapes without pulling server-only code. |

---

## In Progress

<!-- Only ONE feature at a time. -->

| ID | Feature | Status | Blockers |
|----|---------|--------|----------|
| –  | –       | (idle — F06 complete; F07 next up; F03 demo-user login test still pending `SUPABASE_SERVICE_ROLE_KEY`) | – |

---

## Pending Features

<!-- Ordered by priority. Build features in this order. Do not reorder without explicit instruction. -->

| ID  | Feature                          | Phase | Dependencies     |
|-----|----------------------------------|-------|------------------|
| F07 | Calendar — Month Grid View       | 2     | F06 ✅           |
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

3. **2026-05-08 — Cal Sans loaded at single weight (400) from Google Fonts.**
   PRD Section 6 specifies headings at weight 500. Cal Sans on Google Fonts ships only weight 400 — no 500/600/700 variants. We accepted this for v1 because the visual difference between weight 400 and 500 in a geometric display sans like Cal Sans is negligible at the display sizes we use it (28px / 20px). CSS `font-weight: 500` causes the browser to synthesise a slightly heavier weight. If the look becomes a problem, we'll switch to self-hosting the multi-weight `CalSans-SemiBold.woff2` from `github.com/calcom/sans` (SIL OFL licensed) via `next/font/local`.

4. **2026-05-08 — Tailwind CSS v4 (CSS-first `@theme`) instead of v3 (JS config).**
   Tailwind v4 lets us register all PRD Section 6 tokens directly in `app/globals.css` via `@theme inline { --color-cal-bg: var(--cal-bg); ... }`, which keeps the Cal.com canonical token names, the Shadcn UI compatibility aliases (`--background`, `--primary`, etc.), and the Tailwind utility names all in one file. v3 would have required maintaining the same mapping in both `globals.css` and `tailwind.config.ts`. No `tailwind.config.{ts,js}` file exists by design.

---

## Known Issues

<!-- Track bugs or incomplete items discovered during development. -->

1. **Holiday type counts (10/8/3) deviate from PRD Section 15 (10/6/5).** Following prototype data per Architecture Decision #2. Resolution path documented there. Severity: low — does not affect any feature.

2. ~~**Supabase RLS policies for tenant isolation deferred to F03.**~~ ✅ **Resolved in F03 (2026-05-08).** Migration `drizzle/0001_rls_policies.sql` enables RLS on all 16 tables and adds 25 policies. Helper functions `public.is_platform_admin()` and `public.user_tenant_ids()` provide the lookup. `cem_audit_log` has only INSERT and SELECT policies — UPDATE/DELETE are denied at the database level (closes part of F18's checkpoint early).

---

## Security Audit Log

<!-- After each feature, record the security test result. Append rows; never remove. -->

| Feature | Date       | Critical | High | Medium | Low | Status                                             |
|---------|------------|----------|------|--------|-----|----------------------------------------------------|
| F01     | 2026-05-07 | 0        | 0    | 6      | 1   | ✅ PASS — 1 High found and fixed (drizzle-orm SQLi → bumped to ^0.45.2). 6 Medium are transitive npm-audit dev-time issues with no upstream fix; documented in `SECURITY_TEST_REPORT.md`. 1 Low is the demo seed password (acceptable per file header). |
| F02     | 2026-05-08 | 0        | 0    | 6      | 0   | ✅ PASS — Zero new findings. Defense-in-depth additions: header-spoof sanitisation, UUID shape validation, reserved-subdomain allowlist, 308 canonical-host redirect. 6 Medium npm-audit findings carry over from F01 (unchanged). End-to-end verified against 6 host scenarios. |
| F03     | 2026-05-08 | 0        | 0    | 6      | 0   | ✅ PASS (subject to end-to-end demo login test pending key) — Zero new findings. Defense-in-depth additions: safeNextPath() for redirect validation, generic auth error messages (no user enumeration), shouldCreateUser=false on magic links, GET-on-logout returns 405, server-side role check post-signin. RLS now on all 16 tables (closes Known Issue #2). 6 Medium npm-audit carry-over (unchanged). Login/no-access/logout routes verified live; production build green. |
| F04     | 2026-05-08 | 0        | 0    | 6      | 0   | ✅ PASS — Zero new findings. CSP header added with 11 directives (default-src, script-src, style-src, img-src, font-src, connect-src, frame-ancestors, base-uri, form-action, object-src, upgrade-insecure-requests in prod). Fonts self-hosted by `next/font/google` — no third-party CDN load at runtime. No new XSS surfaces (no `dangerouslySetInnerHTML`, no inline style strings from user input). 6 Medium npm-audit carry-over (unchanged). Production build green; all 7 routes including new `/design-tokens` verified. |
| F05     | 2026-05-08 | 0        | 0    | 6      | 0   | ✅ PASS — Zero new findings. NavBar is a server component → role decisions never enter the client bundle. Anonymous HTML verified to contain zero "Dashboard" / role-label leakage. Logout uses form POST (not GET link) → can't be triggered by prefetch / image / spider. Client components (NavLink, NotificationBell, RoleBadge) take no session data — RoleBadge receives a typed `role` prop, NavLink only reads `usePathname()`. 6 Medium npm-audit carry-over (unchanged). |
| F06     | 2026-05-08 | 0        | 0    | 6      | 0   | ✅ PASS — Zero new findings. Tenant-scoped queries (every cem_events / cem_departments select includes WHERE tenant_id = ?). Drizzle `ilike` for search, with SQL LIKE meta-chars (\, %, _) escaped before interpolation. Search input length capped at 200 chars both server-side (slice in events.ts) and client-side (maxLength=200). `lib/cem/events.ts` marked `import "server-only"` — client components can't accidentally pull DB code. Type-only module `lib/cem/types.ts` lets client components share shapes safely. 6 Medium npm-audit carry-over. |

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
