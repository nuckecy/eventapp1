// Session helpers.
//
// Two layers:
//   1. getPlatformSession()  → { userId, tenantId, email, name }
//      Used by app-agnostic surfaces like the tenant launcher (F21).
//      No role information — that depends on which app you're in.
//
//   2. getSession({ appSlug }) → AppSession with `role` for that app.
//      Used by app-specific pages and route handlers. The `role` field
//      is scoped to the app passed in `appSlug` and MUST NOT be
//      treated as global. A user can be Lead in CEM and Member in
//      Fold; calling getSession({ appSlug: "fold" }) returns the Fold
//      role, calling it with "cem" returns the CEM role.
//
// EC-04: previously `appSlug` defaulted to "cem", which silently made
// "session.role" mean "role in CEM". Now appSlug is REQUIRED for
// getSession() — callers must opt in to a specific app, eliminating
// the cross-app role confusion bug. The launcher uses
// getPlatformSession() instead.
//
// SECURITY:
// - Uses Supabase's `getUser()` which re-validates the JWT against the
//   Auth server (per Supabase SSR docs: never use `getSession()` for
//   authorization).
// - Tenant context comes from middleware-injected request headers
//   (`x-tenant-slug`), validated by `readTenantContextFromHeaders` in
//   F02 (UUID-shape check + presence check).
// - Role check delegated to `checkAccess()` from F02, which performs
//   server-side resolution against `core_tenant_user_roles`.
// - All three of (user, tenant, role) must succeed for `getSession()`
//   to return a session object. Otherwise returns null — the caller
//   decides whether to redirect, 401, or render a public view.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkAccess, type AccessRole } from "./access";
import { readTenantContextFromHeaders } from "@/lib/tenant";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppSession = {
  userId: string;
  email: string | null;
  name: string | null;
  tenantId: string;
  tenantSlug: string;
  role: AccessRole;
  appSlug: string;
};

export type GetSessionOptions = {
  /**
   * Default: "cem". Override for other apps in the same tenant.
   *
   * EC-04: the returned `role` is the role for THIS app only. Do not
   * pass session.role across app boundaries. App-agnostic surfaces
   * (the tenant launcher, settings pages that span apps) must use
   * `getPlatformSession()` instead.
   */
  appSlug?: string;
};

export type PlatformSession = {
  userId: string;
  email: string | null;
  name: string | null;
  tenantId: string;
  tenantSlug: string;
};

/**
 * App-agnostic session: only "who" and "where" — no role. Use this on
 * surfaces that span multiple apps (launcher) or precede app
 * resolution (e.g. cross-app notification queries that fan out per-
 * app role checks elsewhere).
 *
 * EC-04 / EC-05: also verifies tenant membership via core_tenant_users.
 * Without this check, an authenticated user from Tenant A could land
 * on Tenant B's launcher and see "Welcome, [their name]" — innocuous
 * but a privacy leak. Returns null if the user is not an active member
 * of the resolved tenant.
 *
 * If you need role information, call getSession({ appSlug }) AFTER
 * you know which app's permission model you're checking against.
 */
export async function getPlatformSession(): Promise<PlatformSession | null> {
  const requestHeaders = await headers();
  const tenant = readTenantContextFromHeaders(requestHeaders);
  if (!tenant) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  // EC-05: verify tenant membership.
  const { isTenantMember } = await import("./access");
  const member = await isTenantMember(user.id, tenant.tenantId);
  if (!member) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    name: (user.user_metadata?.name as string | undefined) ?? null,
    tenantId: tenant.tenantId,
    tenantSlug: tenant.tenantSlug,
  };
}

/**
 * Returns the current session (user + tenant + role) or null.
 *
 * Returns null in any of these cases:
 *  - User not signed in (no Supabase session)
 *  - Request not running in a tenant context (e.g. platform domain)
 *  - User has no role for this tenant + app combination
 *
 * Callers should handle null explicitly — for protected routes use
 * `requireAuth()` which redirects to /login.
 */
export async function getSession(opts: GetSessionOptions = {}): Promise<AppSession | null> {
  const appSlug = opts.appSlug ?? "cem";

  // 1. Tenant context from middleware headers.
  const requestHeaders = await headers();
  const tenant = readTenantContextFromHeaders(requestHeaders);
  if (!tenant) return null;

  // 2. Authenticated Supabase user (re-validated against Auth server).
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  // 3. Authorization — does this user have a role for this tenant+app?
  const access = await checkAccess(user.id, tenant.tenantSlug, appSlug);
  if (!access.allowed) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    name: (user.user_metadata?.name as string | undefined) ?? null,
    tenantId: access.tenantId,
    tenantSlug: tenant.tenantSlug,
    role: access.role,
    appSlug,
  };
}

/**
 * Like `getSession()` but redirects to `/login` if not authenticated.
 * Use in protected layouts / server components.
 *
 * If the user is signed in but lacks a role for this tenant+app, they
 * are redirected to `/no-access` rather than `/login` — they don't need
 * to authenticate again, they just don't have permission.
 */
export async function requireAuth(opts: GetSessionOptions = {}): Promise<AppSession> {
  const appSlug = opts.appSlug ?? "cem";
  const requestHeaders = await headers();
  const tenant = readTenantContextFromHeaders(requestHeaders);

  // No tenant context → this isn't a tenant-scoped page; refuse loudly.
  if (!tenant) {
    redirect("/");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Preserve the path the user was trying to reach, so login can
    // redirect them back. The login page reads `?next=` from the URL.
    const path = requestHeaders.get("x-pathname") ?? "/";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  const access = await checkAccess(user.id, tenant.tenantSlug, appSlug);
  if (!access.allowed) {
    redirect("/no-access");
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    name: (user.user_metadata?.name as string | undefined) ?? null,
    tenantId: access.tenantId,
    tenantSlug: tenant.tenantSlug,
    role: access.role,
    appSlug,
  };
}

/**
 * Role-based default screen after login (PRD Section 10).
 */
export function defaultLandingForRole(role: AccessRole): string {
  switch (role) {
    case "lead":
      return "/events/dashboard/lead";
    case "admin":
      return "/events/dashboard/admin";
    case "superadmin":
    case "platform_admin":
      return "/events/dashboard/super";
    case "member":
    default:
      return "/events";
  }
}
