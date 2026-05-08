# Security Test Report

**Project:** Church Event Management System
**Latest run:** 2026-05-08 (F02)

> Each feature run appends a new section. Earlier sections preserved for audit.

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
