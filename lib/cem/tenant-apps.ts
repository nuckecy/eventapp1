// Tenant-app data layer (F21).
//
// Resolves which apps the platform supports and which ones are
// enabled for a given tenant. Used by:
//   - The Tenant App Launcher (root page) to render cards.
//   - App layouts (e.g. /events) to gate access at server-render
//     time. If the tenant doesn't have CEM enabled, we redirect to
//     the launcher with a "not available" notice rather than 404.
//
// SECURITY:
// - All queries are tenant-scoped. The `core_tenant_apps` row IS the
//   permission to use the app — without it, the layout redirects.
// - Reads are cached for 60s via React's `unstable_cache` because
//   tenant-app enablement changes very rarely (admin operations).
//   Within the cache window, a freshly-disabled app is still visible
//   to in-flight sessions; the worst case is 60s of access. Per
//   PRD §16 rule 3 this is the acceptable trade-off.
// - This module is `server-only`.

import "server-only";

import { unstable_cache } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { coreApps, coreTenantApps } from "@/db/schema";

const CACHE_TTL_SECONDS = 60;

export type AppRegistryItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  enabled: boolean;
  /** Status from core_apps.status (active / coming_soon / etc.) */
  status: string;
};

/**
 * Returns every app in the registry, joined to the tenant's
 * enablement state. Apps without a row in core_tenant_apps come back
 * with `enabled = false` so the launcher can render them as greyed
 * "not available" tiles instead of hiding them entirely.
 */
export const listAppsForTenant = unstable_cache(
  async (tenantId: string): Promise<AppRegistryItem[]> => {
    const rows = await db
      .select({
        id: coreApps.id,
        slug: coreApps.slug,
        name: coreApps.name,
        description: coreApps.description,
        status: coreApps.status,
        enabled: coreTenantApps.enabled,
      })
      .from(coreApps)
      .leftJoin(
        coreTenantApps,
        and(
          eq(coreTenantApps.app_id, coreApps.id),
          eq(coreTenantApps.tenant_id, tenantId),
        ),
      );

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      // A tenant has access when a row exists AND enabled is true.
      enabled: r.enabled === true,
      status: r.status ?? "active",
    }));
  },
  ["listAppsForTenant"],
  { revalidate: CACHE_TTL_SECONDS, tags: ["tenant-apps"] },
);

/**
 * Predicate used by app layouts to decide whether to render the app
 * or redirect to the launcher.
 */
export async function isAppEnabledForTenant(
  tenantId: string,
  appSlug: string,
): Promise<boolean> {
  const apps = await listAppsForTenant(tenantId);
  const app = apps.find((a) => a.slug === appSlug);
  return app?.enabled === true;
}
