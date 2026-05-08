# Security Test Report

**Date:** 2026-05-07
**Project:** Church Event Management System
**Scan scope:** F01 — Database + ORM
**Files audited:**
`db/schema/core.ts`, `db/schema/cem.ts`, `db/schema/index.ts`, `db/index.ts`, `db/seed.ts`, `db/verify.ts`, `drizzle.config.ts`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `package.json`, `tsconfig.json`, `.env`, `.env.example`, `.gitignore`

## Summary

| Severity   | Found | Fixed | Manual Review |
|------------|-------|-------|---------------|
| 🔴 Critical | 0     | 0     | 0             |
| 🟠 High     | 1     | 1     | 0             |
| 🟡 Medium   | 6     | 0     | 6             |
| ⚪ Low      | 1     | 0     | 1             |

**Result: PASS for F01 acceptance.** Zero Critical, zero High remaining. All Medium issues are transitive dev-time `npm audit` findings with no upstream fix; documented and accepted.

---

## Issues

### 🟠 High (1) — FIXED

1. **[Dependencies]** — `package.json`
   - **Issue:** `drizzle-orm@0.36.4` was vulnerable to SQL injection via improperly escaped SQL identifiers (GHSA-gpj5-g38j-94v9). Fixed in 0.45.2.
   - **Fix:** Bumped `drizzle-orm` to `^0.45.2` and re-ran `npm install`. Verified with `npm audit`. No code changes needed; our schema and queries don't use the affected APIs anyway.

### 🟠 High (was flagged, then re-categorised as not-an-issue)

1. **[SQL Injection]** — `db/verify.ts:10` (original, now fixed)
   - **Issue (initial):** `sql.raw(\`SELECT count(*)::int AS count FROM ${table}\`)` — string-interpolated table name into raw SQL. The interpolated value comes from a hardcoded array, not user input, so unexploitable in practice. But the pattern violates the project's "parameterized queries only" rule (PRD Section 16, rule 2; SECURITY_TEST.md item 2).
   - **Fix:** Refactored to use Drizzle's typed table objects (`db.select({ c: sql\`count(*)::int\` }).from(table)` where `table` is a `PgTable` import, not a string). No string interpolation into SQL anywhere in the codebase now.

### 🟡 Medium (6) — Manual review / accepted

1-3. **[Dependencies — esbuild]** — transitive via `drizzle-kit` ➜ `@esbuild-kit/esm-loader` ➜ `@esbuild-kit/core-utils` ➜ `esbuild@<=0.24.2` (GHSA-67mh-4wv8-2f99).
   - **Risk:** esbuild's dev server allows any website to send requests and read responses. Only relevant when running `drizzle-kit studio` on a development machine.
   - **Why not fixed:** `npm audit fix --force` proposes downgrading to `drizzle-kit@0.18.1`, an ancient version that doesn't support our schema. The chain is dev-only and is not bundled into production. Will be eliminated when `drizzle-kit` removes its `@esbuild-kit/*` dependency in a future release.
   - **Mitigation:** Don't run `drizzle-kit studio` on untrusted networks. Production builds never include `drizzle-kit`.

4-6. **[Dependencies — postcss]** — transitive via `next` ➜ `postcss@<8.5.10` (GHSA-qx2v-qp2m-jg93).
   - **Risk:** XSS via unescaped `</style>` in PostCSS's CSS Stringify Output. Only triggers if user-controlled CSS is fed through PostCSS's stringifier in production. Our app does not do this.
   - **Why not fixed:** `npm audit fix --force` proposes downgrading to `next@9.3.3`, which is years old and incompatible. Next.js 15+ already includes a patched postcss internally for runtime; the audit warning is a known false positive against the dev-time `postcss` package.
   - **Mitigation:** No user-supplied CSS is processed in this app. Will be re-checked on every Next.js upgrade.

### ⚪ Low (1) — Accepted

1. **[Hardcoded Demo Password]** — `db/seed.ts:47`
   - **Finding:** `const DEMO_PASSWORD = "Password123!";`
   - **Why this is acceptable:** Used only by the seed script for development to create logins for the 4 demo users (John Doe, Otobong Okoko, Admin Sarah, Pastor James). The password is documented in the file's header comment so developers can log in. It's never used by production code, and never sent to any production-facing system. The seed script itself bcrypts it before insertion (cost factor 12, per PRD Section 16 rule 6).
   - **Action:** None. Will be irrelevant once F03 (Supabase Auth) ships, since the demo accounts will be re-created via Supabase's auth flow.

---

## Verified Controls (F01 security checkpoint)

Per CLAUDE.md F01 entry:

- [x] **No hardcoded connection strings.** `db/index.ts` reads `DATABASE_URL` from env, throws if missing. `drizzle.config.ts` reads `DIRECT_URL` (or `DATABASE_URL`) from env via `dotenv`.
- [x] **`.env` contains `DATABASE_URL`.** Confirmed.
- [x] **`.env` in `.gitignore`.** Confirmed (lines 13–18 of `.gitignore`, including `.env`, `.env.local`, etc.).
- [x] **SSL required for database connection.** `db/index.ts` sets `ssl: "require"` for any non-localhost host. Supabase always serves over TLS.

## Verified Controls (general project rules)

- [x] **Parameterized queries only.** No `sql.raw` with interpolation. Drizzle's tagged-template `sql\`...\`` is parameter-safe by construction. Verified via grep.
- [x] **No `userId` from request body.** No request handlers in F01 yet, but pattern check passes. Grep for `body\.user[Ii]d` returned nothing.
- [x] **No `Math.random()` used for security.** Grep clean.
- [x] **No CORS wildcards.** Grep clean.
- [x] **No `eval()` / `new Function()`.** Grep clean.
- [x] **No `dangerouslySetInnerHTML`.** Grep clean.
- [x] **No `child_process.exec` / shell:true.** Grep clean.
- [x] **No localStorage/sessionStorage for sensitive data.** Grep clean.
- [x] **Security headers configured.** `next.config.ts` sets HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy. CSP deferred to F04 (after fonts/Shadcn integration).
- [x] **TypeScript strict mode.** `tsconfig.json` has `"strict": true`. Project compiles cleanly (`tsc --noEmit` returns 0 errors).

## Deferred to later features

- **`cem_audit_log` INSERT-only enforcement at DB level** — schema is created but the GRANT/REVOKE that locks it down belongs to F18 (Audit Log feature). Documented in `db/schema/cem.ts` header comment.
- **Supabase RLS policies for tenant isolation** — schema is in place; policies will be added during F02 (Tenant Middleware) per Architecture Decision #1.
- **Rate limiting on auth endpoints** — F03.
- **CSRF tokens on state-changing requests** — F03.
- **Bcrypt password hashing for non-Supabase-Auth flows** — F03 (already used by the dev seed for parity).
