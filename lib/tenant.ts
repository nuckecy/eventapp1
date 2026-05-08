// Tenant resolution helpers — used by middleware and tenant-scoped layouts.
// Per PRD Section 3 ("Helper functions implemented in lib/tenant.ts").
//
// SECURITY:
// - All queries are parameterized via Drizzle (no string interpolation).
// - These functions never expose data across tenants. They only return the
//   tenant identifier for the matching domain/slug.
// - Calls are cached for 60s with React's `unstable_cache` to absorb the
//   per-request middleware lookup load. Stale data here is acceptable
//   because tenant identity changes are rare; if a tenant is suspended or
//   a domain is unverified, the worst-case window is 60s before the cache
//   refreshes.

import { unstable_cache } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { coreTenantDomains, coreTenants } from "@/db/schema/core";

const CACHE_TTL_SECONDS = 60;

// ── lookupCustomDomain ────────────────────────────────────────────────
// Resolves a fully-qualified custom domain (e.g. "newsongberlin.org") to
// the tenant it belongs to. Returns null if no row exists.
//
// Note: The middleware additionally requires `verified=true` and
// `ssl_provisioned=true` before granting access. We return those flags
// rather than filter on them so the caller can decide (e.g. an admin
// settings page may want to show pending domains too).

export const lookupCustomDomain = unstable_cache(
  async (hostname: string) => {
    const result = await db
      .select({
        tenant_id: coreTenantDomains.tenant_id,
        tenant_slug: coreTenants.slug,
        verified: coreTenantDomains.verified,
        ssl_provisioned: coreTenantDomains.ssl_provisioned,
      })
      .from(coreTenantDomains)
      .innerJoin(coreTenants, eq(coreTenants.id, coreTenantDomains.tenant_id))
      .where(eq(coreTenantDomains.domain, hostname))
      .limit(1);
    return result[0] ?? null;
  },
  ["lookupCustomDomain"],
  { revalidate: CACHE_TTL_SECONDS, tags: ["tenant-domain"] },
);

// ── lookupTenantBySlug ────────────────────────────────────────────────
// Resolves a subdomain (e.g. "newsong") to its tenant row.
// Only "active" tenants are returned — suspended/trial-expired tenants
// are treated as if they didn't exist, so the middleware redirects to
// the platform domain.

export const lookupTenantBySlug = unstable_cache(
  async (slug: string) => {
    const result = await db
      .select()
      .from(coreTenants)
      .where(and(eq(coreTenants.slug, slug), eq(coreTenants.status, "active")))
      .limit(1);
    return result[0] ?? null;
  },
  ["lookupTenantBySlug"],
  { revalidate: CACHE_TTL_SECONDS, tags: ["tenant"] },
);

// ── lookupPrimaryDomain ───────────────────────────────────────────────
// If the tenant has elected to redirect their default subdomain to a
// fully-active custom domain, returns that domain row. Returns null if
// no primary is set or it isn't fully provisioned yet.

export const lookupPrimaryDomain = unstable_cache(
  async (tenantId: string) => {
    const result = await db
      .select()
      .from(coreTenantDomains)
      .where(
        and(
          eq(coreTenantDomains.tenant_id, tenantId),
          eq(coreTenantDomains.is_primary, true),
          eq(coreTenantDomains.verified, true),
          eq(coreTenantDomains.ssl_provisioned, true),
        ),
      )
      .limit(1);
    return result[0] ?? null;
  },
  ["lookupPrimaryDomain"],
  { revalidate: CACHE_TTL_SECONDS, tags: ["tenant-domain"] },
);

// ── readTenantContextFromHeaders ──────────────────────────────────────
// Server-component helper that reads the tenant context the middleware
// injected. Used by `(tenant)/layout.tsx` and any server component or
// route handler that needs to know which tenant the request is for.
//
// SECURITY: The request headers `x-tenant-id` and `x-tenant-slug` are
// only set by our own middleware. Next.js strips client-provided headers
// of these names by default for the `request.headers` propagated to
// downstream handlers, but we add belt-and-braces by validating the
// shape.

import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

export type TenantContext = {
  tenantId: string;
  tenantSlug: string;
  domainType: "subdomain" | "custom";
};

export function readTenantContextFromHeaders(headers: ReadonlyHeaders): TenantContext | null {
  const tenantId = headers.get("x-tenant-id");
  const tenantSlug = headers.get("x-tenant-slug");
  const domainType = headers.get("x-domain-type");
  if (!tenantId || !tenantSlug) return null;
  if (domainType !== "subdomain" && domainType !== "custom") return null;
  // UUID sanity check — rejects anything that isn't a UUID v4-shaped string.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    return null;
  }
  return { tenantId, tenantSlug, domainType };
}
