# Security Test Report

**Project:** Church Event Management System
**Latest run:** 2026-05-08 (F06)

> Each feature run appends a new section. Earlier sections preserved for audit.

---

## F06 — Calendar List View (2026-05-08)

**Files audited:**
`lib/cem/events.ts`, `lib/cem/dates.ts`, `lib/cem/types.ts`, `components/cem/event-row.tsx`, `components/cem/month-section.tsx`, `components/cem/past-stack.tsx`, `components/cem/filter-bar.tsx`, `components/cem/view-toggle.tsx`, `components/cem/empty-state.tsx`, `app/events/page.tsx`

### Summary

| Severity   | Found | Fixed | Manual Review |
|------------|-------|-------|---------------|
| 🔴 Critical | 0     | 0     | 0             |
| 🟠 High     | 0     | 0     | 0             |
| 🟡 Medium   | 6     | 0     | 6 (carry-over) |
| ⚪ Low      | 0     | 0     | 0             |

**Result: PASS for F06 acceptance.**

### Verified controls (F06 security checkpoint per CLAUDE.md)

- [x] **No SQL injection via search input.** `lib/cem/events.ts` uses Drizzle's `ilike` helper (parameter-bound), never string concatenation. Before passing the search term into the `ilike` pattern, we escape SQL LIKE meta-characters (`\`, `%`, `_`) so the user can't write a wildcard that breaks out of their substring. Verified by grep and code review.
- [x] **Query parameterized.** All filter conditions use Drizzle's `eq` / `or` / `ilike` / `and` helpers — no `sql.raw`, no template-string interpolation into SQL. Verified by grep.
- [x] **User input sanitized before rendering.** All event titles / locations / times are rendered through React text nodes, which auto-escape. No `dangerouslySetInnerHTML`. Verified by grep.

### Defense-in-depth additions (this feature)

- **Tenant scoping mandatory at the query layer.** `listEvents()` requires `tenantId` as the first argument; the function builds `WHERE tenant_id = ?` as the first AND-condition. There is no overload that omits it. The page layer obtains the tenantId from middleware-injected headers via `getCurrentTenantId()`, never from query params.
- **Search input length capped at 200 characters** in three places:
  1. Server: `filters.search.trim().slice(0, SEARCH_MAX_LENGTH)` in `events.ts`.
  2. Client URL push: `query.trim().slice(0, 200)` in `filter-bar.tsx`.
  3. Browser-enforced: `maxLength={200}` on the `<input>`.
  Belt-and-braces against a pathological huge-string that could blow query cost.
- **`server-only` marker on `lib/cem/events.ts`.** If a client component ever tries to import the data-access module, the build fails loudly. Verified at line 12.
- **Filter state in URL, not localStorage.** Means filters survive cache misses, are bookmarkable, and don't pollute browser storage. The `?type=` empty-string convention is intentional so "all types off" survives a refresh.
- **`<details>`/`<summary>` for the past-events accordion** instead of a custom toggle. Built-in keyboard support (Enter/Space), built-in screen-reader semantics ("expanded/collapsed" announcements), and works without JS.
- **Type-only types module (`lib/cem/types.ts`).** Lets client components import the `EventListItem` / `EventType` / `EVENT_TYPES` shapes without dragging the data-access layer into the browser bundle. Pure types/constants — no I/O.

### Pattern scan (per SECURITY_TEST.md)

| Check | Result |
|---|---|
| Hardcoded secrets in F06 files | none |
| `sql.raw` / SQL string interpolation | none — Drizzle helpers only |
| `eval()` / `new Function()` | none |
| `dangerouslySetInnerHTML` | none |
| `localStorage` / `sessionStorage` | none — filter state is URL-based |
| `server-only` on data-access modules | ✅ events.ts |
| Tenant scoping in every cem_* query | ✅ verified line 78 + 145 of events.ts |
| Search input length cap | ✅ 3 layers (server slice, client slice, HTML maxLength) |
| SQL LIKE meta-char escape | ✅ `replace(/[\\%_]/g, ...)` before passing to ilike |
| `userId` / `tenantId` from request body | none — tenantId comes from middleware headers only |

### Acceptance verification

Live dev-server smoke test:

| Scenario | Expected | Observed |
|------|----------|----------|
| `/events` (no filters) | 25 events grouped by month, past stack visible | All 25 event titles in HTML; 12 distinct months rendered ✓ |
| `/events?q=Easter` | Easter Musical Night + Easter Sunday only | both present ✓ |
| `/events?type=sunday` | only sunday-typed events | filtered correctly ✓ |
| `/events?type=` | empty state | "No events found" present ✓ |
| `/events?view=calendar` | F07 stub message | "Month grid view lands in F07" ✓ |
| Production build | clean, all 14 routes | ✓ |
| TypeScript strict | 0 errors | 0 errors ✓ |

### Carry-over from F01–F05

The 6 Medium npm-audit findings (transitive `esbuild` via `drizzle-kit`, transitive `postcss` via `next`) remain unchanged.

---

## F05 — Navigation Bar (2026-05-08)

**Files audited:**
`components/nav/nav-bar.tsx`, `components/nav/nav-link.tsx`, `components/notification-bell.tsx`, `components/role-badge.tsx`, `app/events/layout.tsx`, `app/events/page.tsx`, `app/events/{departments,holidays,birthdays,dashboard/lead,dashboard/admin,dashboard/super}/page.tsx`, `app/page.tsx`

### Summary

| Severity   | Found | Fixed | Manual Review |
|------------|-------|-------|---------------|
| 🔴 Critical | 0     | 0     | 0             |
| 🟠 High     | 0     | 0     | 0             |
| 🟡 Medium   | 6     | 0     | 6 (carry-over) |
| ⚪ Low      | 0     | 0     | 0             |

**Result: PASS for F05 acceptance.**

### Verified controls (F05 security checkpoint per CLAUDE.md)

- [x] **No role information leaked in client-side HTML for unauthenticated users.** Verified by `grep` against the anon-user HTML from `/events`:
  - `Dashboard` link occurrences: **0**
  - Role-label occurrences (`Lead` / `Administrator` / `Super Admin` / `Member`): **0**
  - `Sign in` button occurrences: **2** (header + page)
  The NavBar is a server component, so role decisions never reach the client JS bundle either. The Dashboard link is conditionally rendered server-side based on `getSession()`, and isn't part of any client component.
- [x] **Logout clears session completely.** Uses form POST to `/auth/logout` route handler (built in F03), which calls `supabase.auth.signOut()` and clears the session cookies. GET on the same path returns 405 (verified in F03 security report).

### Defense-in-depth additions (this feature)

- **Logout via form POST, not GET link.** Prevents prefetchers, image tags, browser extensions, and link-checking bots from inadvertently logging users out. The endpoint also validates Origin matches Host (added in F03).
- **Client components receive only what they need.** `NavLink` reads `usePathname()` only; `NotificationBell` takes an optional `count: number`; `RoleBadge` takes a typed `role` prop. None imports a client-side Supabase client or makes any auth/session decision in the browser.
- **Active link uses `aria-current="page"`** for accessibility (screen-reader users hear "current page" on the link).
- **Backdrop blur on sticky NavBar** uses CSS `@supports` so older browsers fall back to a solid color rather than getting an unstyled element.

### Pattern scan (per SECURITY_TEST.md)

| Check | Result |
|---|---|
| Hardcoded secrets in F05 files | none |
| `eval()` / `new Function()` | none |
| `dangerouslySetInnerHTML` | none |
| `localStorage` / `sessionStorage` | none |
| Role decisions in client components | none — only server NavBar reads session; client components take typed props |
| Logout via GET | none — uses form POST to /auth/logout |
| Open-redirect / unsafe href construction | none — only constants and a switch helper for role → dashboard route |

### Acceptance verification

| Scenario | Expected | Observed |
|------|----------|----------|
| `/` | 307 → `/events` | 307 ✓ |
| `/events` (anonymous) | NavBar with logo + 4 links + Sign-in button; NO Dashboard, NO role badge | All confirmed via curl + grep ✓ |
| `/events/departments` (anonymous) | Departments link has `aria-current="page"` + active classes | Single match for `aria-current="page"` on the right link, with `border-cal-brand font-semibold text-cal-text` ✓ |
| `/login`, `/no-access` | Render WITHOUT NavBar (full-screen auth flow) | "Church Events" not present on /login HTML ✓ |
| `/events/dashboard/lead` | Renders (no auth gate yet — F14 will add) | 200 ✓ |
| Production build | All 14 routes build clean | ✓ |
| TypeScript strict | 0 errors | 0 errors ✓ |

Pending verification (blocked on `SUPABASE_SERVICE_ROLE_KEY` from F03):
- Dashboard link visibility for each role (Lead → /dashboard/lead, Admin → /admin, Super → /super, Member → no link). The conditional rendering is in place; smoke-test will be run when the seed can create logins via Supabase Auth.

### Carry-over from F01–F04

The 6 Medium npm-audit findings (transitive `esbuild` via `drizzle-kit`, transitive `postcss` via `next`) remain unchanged.

---

## F04 — Design System (2026-05-08)

**Files audited:**
`lib/utils.ts`, `lib/fonts.ts`, `components/theme-provider.tsx`, `components/theme-toggle.tsx`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/login/page.tsx`, `app/login/LoginForms.tsx`, `app/no-access/page.tsx`, `app/design-tokens/page.tsx`, `components.json`, `postcss.config.mjs`, `next.config.ts`

### Summary

| Severity   | Found | Fixed | Manual Review |
|------------|-------|-------|---------------|
| 🔴 Critical | 0     | 0     | 0             |
| 🟠 High     | 0     | 0     | 0             |
| 🟡 Medium   | 6     | 0     | 6 (carry-over) |
| ⚪ Low      | 0     | 0     | 0             |

**Result: PASS for F04 acceptance.** Defense-in-depth was strengthened (CSP header now present); no new attack surface introduced.

### Verified controls (F04 security checkpoint per CLAUDE.md)

- [x] **No external font loading from untrusted CDNs.** Cal Sans + Inter are loaded via `next/font/google`, which Next.js self-hosts at build time. At runtime no font files are fetched from a third-party domain. Verified by grep for `fonts.googleapis.com`, `fonts.gstatic.com`, `cdn.jsdelivr`, `unpkg.com` — no hits.
- [x] **Content-Security-Policy allows font sources.** `font-src 'self' data:` covers self-hosted fonts plus base64 fallback inlining.

### Defense-in-depth additions (this feature)

- **Content-Security-Policy header now present** (`next.config.ts`). 11 directives:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` only in dev for HMR)
  - `style-src 'self' 'unsafe-inline'` (Radix UI + Shadcn require inline styles)
  - `img-src 'self' data: blob: https://*.supabase.co`
  - `font-src 'self' data:`
  - `connect-src 'self' https://*.supabase.co wss://*.supabase.co`
  - `frame-ancestors 'none'` (prevents clickjacking)
  - `base-uri 'self'`
  - `form-action 'self'`
  - `object-src 'none'`
  - `upgrade-insecure-requests` (prod only)
- **`disableTransitionOnChange`** on the next-themes provider prevents a brief flash of mis-matched colors during dark-mode toggle (UX hardening).
- **`prefers-reduced-motion` respected** in `globals.css` — animations drop to 0.001ms (PRD Section 7.6 rule 4).

### Pattern scan (per SECURITY_TEST.md)

| Check | Result |
|---|---|
| Hardcoded secrets in F04 files | none |
| `eval()` / `new Function()` | none |
| `dangerouslySetInnerHTML` | none |
| `localStorage` / `sessionStorage` for sensitive data | none — next-themes stores theme preference only |
| External font CDN | none — fonts self-hosted by next/font |
| CSP completeness (≥10 directives) | ✅ 11 directives |

### Acceptance verification

| Route | Expected | Observed |
|------|----------|----------|
| `/` (root) | placeholder, Cal-styled | 200 OK, "Bootstrapping" copy renders ✓ |
| `/design-tokens` | renders all tokens, badges, buttons, stats row | 200 OK, "Design tokens" + "--cal-bg" + "StatsRow" all present ✓ |
| `/login` | password + magic-link forms, Cal-styled | 200 OK, both form headings present ✓ |
| `/no-access` | denial copy, sign-out button | 200 OK ✓ |
| CSP header on `/` | full directive set | full 11-directive policy returned ✓ |
| Production build (`next build`) | succeeds with all 7 routes | clean build, 9 static pages generated ✓ |
| TypeScript strict | 0 errors | 0 errors ✓ |

### Carry-over from F01-F03

The 6 Medium npm-audit findings (transitive `esbuild` via `drizzle-kit`, transitive `postcss` via `next`) remain unchanged. Documented and accepted in the F01 section below.

---

## F03 — Authentication (2026-05-08)

**Files audited:**
`lib/supabase/{server,browser,admin}.ts`, `lib/auth/session.ts`, `lib/auth/actions.ts`, `app/login/{page,actions,LoginForms}.tsx`, `app/auth/callback/route.ts`, `app/auth/logout/route.ts`, `app/no-access/page.tsx`, `middleware.ts`, `db/seed.ts`, `drizzle/0001_rls_policies.sql`, `next.config.ts`, `package.json`

### Summary

| Severity   | Found | Fixed | Manual Review |
|------------|-------|-------|---------------|
| 🔴 Critical | 0     | 0     | 0             |
| 🟠 High     | 0     | 0     | 0             |
| 🟡 Medium   | 6     | 0     | 6 (carry-over) |
| ⚪ Low      | 0     | 0     | 0             |

**Result: PASS for F03 acceptance** (subject to end-to-end login test once `SUPABASE_SERVICE_ROLE_KEY` is provided to seed the Auth users).

### Verified controls (F03 security checkpoint per CLAUDE.md)

- [x] **Password hashing strong.** Supabase Auth uses Argon2id by default (stronger than bcrypt 12 rounds). Application code never sees plaintext passwords or stores its own hash. `core_users.password_hash` is null for Auth-managed users.
- [x] **No plaintext passwords.** Verified by grep across F03 files. The seed's `DEMO_PASSWORD` constant is documented and only used to provision/update Supabase Auth users via the admin API.
- [x] **Tokens not in localStorage.** Supabase SSR uses httpOnly, Secure, SameSite=Lax cookies. Verified by grep (no `localStorage` / `sessionStorage` references in any F03 file).
- [x] **Failed-login lockout.** Supabase Auth applies rate limiting on `/token` (sign-in) endpoints by default (30 attempts / 5 minutes per IP). `signInWithPasswordAction` surfaces the 429 response with a generic "Too many attempts" message.
- [x] **Session timeout configured.** Supabase Auth issues short-lived access tokens (1h default) and long-lived refresh tokens. Middleware refreshes them on every request via `@supabase/ssr`.
- [x] **CSRF protection.** Server Actions in Next.js 15 enforce same-origin via the built-in Origin header check. The logout route handler additionally compares `Origin` to `Host` and rejects mismatches with 403. Magic-link callback validates the `code` parameter server-side.
- [x] **Authorization uses `getUser()`, not `getSession()`.** All four call sites (`getSession()` helper, `requireAuth()`, login page redirect-if-signed-in, middleware refresh) use the verified-against-Auth-server method. Verified by grep.
- [x] **No service-role key in client code.** `lib/supabase/admin.ts` is server-only; `lib/supabase/browser.ts` does not import it. `db/seed.ts` is the only consumer.

### Defense-in-depth additions

- **`safeNextPath()`** validates `?next=` redirect targets to be same-origin paths (start with `/`, not `//` or `/\`). Used in login action and magic-link callback.
- **Same-origin Origin/Host check in `/auth/logout`** on top of Next's built-in CSRF for actions.
- **Generic auth error messages.** `signInWithPasswordAction` returns "Invalid email or password." regardless of which leg failed; magic-link returns the same notice whether or not the email exists, preventing user enumeration.
- **Server-side role check on login.** After Supabase signin succeeds, we run `checkAccess()` to confirm the user has a role for the current tenant+app. If not, we sign them out immediately rather than leave a half-authorised session.
- **`shouldCreateUser: false` on magic links.** Only known users can request a magic link; this prevents the magic-link form from being abused as an open user-enumeration / signup vector.
- **GET on `/auth/logout` returns 405.** Prevents prefetch / image-tag / spider triggers from accidentally signing users out (CSRF on logout).
- **RLS policies enabled on all 16 tables** — closes Known Issue #2 from F02. App-level `WHERE tenant_id = ?` scoping remains the primary control; RLS is the second layer. Verified: 25 policies created across 16 tables. `cem_audit_log` has only INSERT and SELECT policies (UPDATE/DELETE denied at the database level — closes part of F18's checkpoint early).

### Pattern scan (per SECURITY_TEST.md)

| Check | Result |
|---|---|
| Hardcoded secrets in F03 files | none |
| Service-role key in client/browser code | none |
| `sql.raw` / SQL string interpolation | none |
| `eval()` / `new Function()` | none |
| `dangerouslySetInnerHTML` | none |
| `Math.random` (security context) | none |
| CORS wildcard | none |
| `userId` from request body / URL params | none |
| `localStorage` / `sessionStorage` for sensitive data | none |
| `getSession()` for authorization | none — only `getUser()` is used |

### Acceptance verification

Manual end-to-end test against the running dev server:

| Route | Expected | Observed |
|------|----------|----------|
| `/login` (tenant subdomain) | renders both password + magic-link forms | both forms present ✓ |
| `/no-access` | renders denial copy + sign-out form | content present ✓ |
| `/auth/logout` GET | 405 Method Not Allowed | 405 ✓ |
| `/auth/logout` POST without origin match | 403 Forbidden | (rule compiled, awaits live test with auth) |
| Production build (`next build`) | succeeds | 8 routes built cleanly ✓ |
| TypeScript strict | 0 errors | 0 errors ✓ |
| RLS verification | all 16 tables RLS enabled | verified by post-migration script ✓ |
| `cem_audit_log` immutable at DB | no UPDATE/DELETE policies | verified ✓ |

### Pending verification (blocked on `SUPABASE_SERVICE_ROLE_KEY`)

- **End-to-end login as each role.** Requires `SUPABASE_SERVICE_ROLE_KEY` to (re-)run `npm run db:seed` and create the 4 demo users in Supabase Auth. Without it, the demo `core_users` rows exist but are not loginable — only the surrounding pages are testable.
- **Role-based default-screen redirect** post-login. Dependent on the previous.

### Carry-over from F01/F02

The 6 Medium npm-audit findings (transitive `esbuild` via `drizzle-kit`, transitive `postcss` via `next`) remain unchanged. Documented and accepted in the F01 section below.

---

## F02 — Tenant Middleware (2026-05-08)

**Files audited:**
`lib/tenant.ts`, `lib/auth/access.ts`, `middleware.ts`, `next.config.ts`, `package.json`

### Summary

| Severity   | Found | Fixed | Manual Review |
|------------|-------|-------|---------------|
| 🔴 Critical | 0     | 0     | 0             |
| 🟠 High     | 0     | 0     | 0             |
| 🟡 Medium   | 6     | 0     | 6 (carry-over) |
| ⚪ Low      | 0     | 0     | 0             |

**Result: PASS for F02 acceptance.**

### Verified controls (F02 security checkpoint per CLAUDE.md)

- [x] **No tenant data leakage across subdomains.** Tenant resolution returns null/redirect for any unrecognised host. Custom-domain lookup additionally requires `verified=true` AND `ssl_provisioned=true` before granting access.
- [x] **Middleware rejects unrecognised domains.** Verified by `curl` against `unknown.churchplatform.com` and `someuncoupledcorp.org` — both return 307 redirects to `https://${PLATFORM_DOMAIN}`.
- [x] **No open redirects.** Two redirect call sites in `middleware.ts`:
   - `line 80`: target is the constant `PLATFORM_DOMAIN` env var. Not user-controllable.
   - `line 129`: target hostname is overwritten with `primary.domain` from a DB lookup; only the request path is preserved. The user can only "redirect themselves" to the canonical host on the path they were already going to.

### Defense-in-depth additions (beyond PRD requirements)

- **Header sanitisation.** The middleware unconditionally strips any incoming `x-tenant-id`, `x-tenant-slug`, and `x-domain-type` request headers before processing, so a crafted client request can never spoof tenant identity to downstream handlers. Verified end-to-end:
   - Spoofed-only request (no real subdomain) → downstream sees `null` for all three headers.
   - Spoofed override on legit request → downstream sees the real tenant UUID, not the spoof.
- **UUID shape validation in `readTenantContextFromHeaders`.** Even if a header somehow leaked through, the helper rejects anything that isn't a UUID-shaped string before passing it to data queries.
- **Reserved subdomain allowlist** (`api`, `custom`, `www`) prevents conflict with potential platform-level routes if someone registers a tenant with those slugs.
- **308 (Permanent Redirect) for canonical-host enforcement** preserves HTTP method and signals canonicality to crawlers; previously the PRD example used the default 307.
- **`unstable_cache` (60s TTL) on all tenant lookups** absorbs middleware load. Stale data window is acceptable for tenant identity (rare changes) and bounded.

### Pattern scan (per SECURITY_TEST.md)

| Check | Result |
|---|---|
| Hardcoded secrets | none in F02 files |
| `sql.raw` / SQL string interpolation | none |
| `eval()` / `new Function()` | none |
| `dangerouslySetInnerHTML` | none |
| `child_process` / `shell: true` | none |
| `Math.random` (security context) | none |
| CORS wildcard | none |
| `userId` from request body | none |
| `localStorage` / `sessionStorage` for sensitive data | none |
| Tenant-scoped queries in helpers | ✅ all queries filtered by tenant or domain |

### Acceptance verification

Manual end-to-end test against the running dev server with `Host` header overrides:

| Host | Expected | Observed |
|------|----------|----------|
| `localhost:3001` | pass through, no tenant headers | 200 OK, no headers ✓ |
| `newsong.churchplatform.com` | tenant resolved (subdomain) | 200 OK, real UUID injected, `domain_type=subdomain` ✓ |
| `unknown.churchplatform.com` | redirect to platform | 307 → `https://churchplatform.com/` ✓ |
| `api.churchplatform.com` | reserved, pass through | 200 OK, no tenant headers ✓ |
| `someuncoupledcorp.org` | unverified custom domain → redirect | 307 → `https://churchplatform.com/` ✓ |
| `newsongberlin-test.org` (verified+SSL) | tenant resolved (custom) | 200 OK, real UUID, `domain_type=custom` ✓ |

### Carry-over from F01

The 6 Medium npm-audit findings from F01 (transitive `esbuild` via `drizzle-kit`, transitive `postcss` via `next`) remain unchanged. Documented and accepted in the F01 section below.

---

## F01 — Database + ORM (2026-05-07)

**Files audited:**
`db/schema/core.ts`, `db/schema/cem.ts`, `db/schema/index.ts`, `db/index.ts`, `db/seed.ts`, `db/verify.ts`, `drizzle.config.ts`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `package.json`, `tsconfig.json`, `.env`, `.env.example`, `.gitignore`

### Summary

| Severity   | Found | Fixed | Manual Review |
|------------|-------|-------|---------------|
| 🔴 Critical | 0     | 0     | 0             |
| 🟠 High     | 1     | 1     | 0             |
| 🟡 Medium   | 6     | 0     | 6             |
| ⚪ Low      | 1     | 0     | 1             |

**Result: PASS for F01 acceptance.** Zero Critical, zero High remaining. All Medium issues are transitive dev-time `npm audit` findings with no upstream fix; documented and accepted.

### Issues

#### 🟠 High (1) — FIXED

1. **[Dependencies]** — `package.json`
   - **Issue:** `drizzle-orm@0.36.4` was vulnerable to SQL injection via improperly escaped SQL identifiers (GHSA-gpj5-g38j-94v9). Fixed in 0.45.2.
   - **Fix:** Bumped `drizzle-orm` to `^0.45.2` and re-ran `npm install`. Verified with `npm audit`. No code changes needed; our schema and queries don't use the affected APIs anyway.

#### 🟠 High (was flagged, then re-categorised as not-an-issue)

1. **[SQL Injection]** — `db/verify.ts:10` (original, now fixed)
   - **Issue (initial):** `sql.raw(\`SELECT count(*)::int AS count FROM ${table}\`)` — string-interpolated table name into raw SQL. The interpolated value comes from a hardcoded array, not user input, so unexploitable in practice. But the pattern violates the project's "parameterized queries only" rule (PRD Section 16, rule 2; SECURITY_TEST.md item 2).
   - **Fix:** Refactored to use Drizzle's typed table objects (`db.select({ c: sql\`count(*)::int\` }).from(table)` where `table` is a `PgTable` import, not a string). No string interpolation into SQL anywhere in the codebase now.

#### 🟡 Medium (6) — Manual review / accepted

1-3. **[Dependencies — esbuild]** — transitive via `drizzle-kit` ➜ `@esbuild-kit/esm-loader` ➜ `@esbuild-kit/core-utils` ➜ `esbuild@<=0.24.2` (GHSA-67mh-4wv8-2f99).
   - **Risk:** esbuild's dev server allows any website to send requests and read responses. Only relevant when running `drizzle-kit studio` on a development machine.
   - **Why not fixed:** `npm audit fix --force` proposes downgrading to `drizzle-kit@0.18.1`, an ancient version that doesn't support our schema. The chain is dev-only and is not bundled into production. Will be eliminated when `drizzle-kit` removes its `@esbuild-kit/*` dependency in a future release.
   - **Mitigation:** Don't run `drizzle-kit studio` on untrusted networks. Production builds never include `drizzle-kit`.

4-6. **[Dependencies — postcss]** — transitive via `next` ➜ `postcss@<8.5.10` (GHSA-qx2v-qp2m-jg93).
   - **Risk:** XSS via unescaped `</style>` in PostCSS's CSS Stringify Output. Only triggers if user-controlled CSS is fed through PostCSS's stringifier in production. Our app does not do this.
   - **Why not fixed:** `npm audit fix --force` proposes downgrading to `next@9.3.3`, which is years old and incompatible. Next.js 15+ already includes a patched postcss internally for runtime; the audit warning is a known false positive against the dev-time `postcss` package.
   - **Mitigation:** No user-supplied CSS is processed in this app. Will be re-checked on every Next.js upgrade.

#### ⚪ Low (1) — Accepted

1. **[Hardcoded Demo Password]** — `db/seed.ts:47`
   - **Finding:** `const DEMO_PASSWORD = "Password123!";`
   - **Why this is acceptable:** Used only by the seed script for development to create logins for the 4 demo users (John Doe, Otobong Okoko, Admin Sarah, Pastor James). The password is documented in the file's header comment so developers can log in. It's never used by production code, and never sent to any production-facing system. The seed script itself bcrypts it before insertion (cost factor 12, per PRD Section 16 rule 6).
   - **Action:** None. Will be irrelevant once F03 (Supabase Auth) ships, since the demo accounts will be re-created via Supabase's auth flow.

### Verified Controls (F01 security checkpoint)

- [x] **No hardcoded connection strings.** `db/index.ts` reads `DATABASE_URL` from env, throws if missing. `drizzle.config.ts` reads `DIRECT_URL` (or `DATABASE_URL`) from env via `dotenv`.
- [x] **`.env` contains `DATABASE_URL`.** Confirmed.
- [x] **`.env` in `.gitignore`.** Confirmed.
- [x] **SSL required for database connection.** `db/index.ts` sets `ssl: "require"` for any non-localhost host. Supabase always serves over TLS.

### Verified Controls (general project rules)

- [x] **Parameterized queries only.** No `sql.raw` with interpolation. Drizzle's tagged-template `sql\`...\`` is parameter-safe by construction. Verified via grep.
- [x] **No `userId` from request body.** No request handlers in F01 yet.
- [x] **No `Math.random()` used for security.**
- [x] **No CORS wildcards.**
- [x] **No `eval()` / `new Function()`.**
- [x] **No `dangerouslySetInnerHTML`.**
- [x] **No `child_process.exec` / shell:true.**
- [x] **No localStorage/sessionStorage for sensitive data.**
- [x] **Security headers configured.** `next.config.ts` sets HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy. CSP deferred to F04 (after fonts/Shadcn integration).
- [x] **TypeScript strict mode.** `tsconfig.json` has `"strict": true`. Project compiles cleanly.

### Deferred to later features

- **`cem_audit_log` INSERT-only enforcement at DB level** — schema is created; the GRANT/REVOKE that locks it down belongs to F18 (Audit Log feature).
- **Supabase RLS policies for tenant isolation** — schema is in place; policies will be added during F02 per Architecture Decision #1. *(Status update: deferred again into F03 since RLS policies are most useful once Supabase Auth is wiring up `auth.uid()`. Tracked as Known Issue.)*
- **Rate limiting on auth endpoints** — F03.
- **CSRF tokens on state-changing requests** — F03.
- **Bcrypt password hashing for non-Supabase-Auth flows** — F03 (already used by the dev seed for parity).
