// Per-tenant CEM settings (feature flags + preferences).
//
// The table has one row per tenant. Reads return defaults if the
// row doesn't exist yet — newly-created tenants don't need their
// settings row materialised until they actively change something.
//
// SECURITY:
// - Reads are public-safe (no sensitive flags here today). Used by
//   the login page (anon) to decide whether to show scripture.
// - Writes are gated to super admin OR platform admin at the action
//   layer; RLS additionally enforces tenant membership.

import "server-only";

import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cemTenantSettings } from "@/db/schema";

export type TenantSettings = {
  scripture_enabled: boolean;
};

const DEFAULTS: TenantSettings = {
  scripture_enabled: true,
};

/**
 * Get the resolved settings for a tenant. Returns defaults for any
 * field not explicitly set — and an entirely default object for
 * tenants that have never written settings.
 *
 * Cached for 60s so login-page renders don't hammer the DB. The
 * cache invalidates via tag when settings are updated.
 */
export const getTenantSettings = unstable_cache(
  async (tenantId: string): Promise<TenantSettings> => {
    const rows = await db
      .select({
        scripture_enabled: cemTenantSettings.scripture_enabled,
      })
      .from(cemTenantSettings)
      .where(eq(cemTenantSettings.tenant_id, tenantId))
      .limit(1);
    if (rows.length === 0) return { ...DEFAULTS };
    return {
      scripture_enabled: rows[0].scripture_enabled ?? DEFAULTS.scripture_enabled,
    };
  },
  ["tenantSettings"],
  { revalidate: 60, tags: ["tenant-settings"] },
);

/**
 * Upsert tenant settings. Caller must verify the actor is allowed to
 * mutate this tenant (super admin OR platform admin) before invoking.
 */
export async function setTenantSettings(
  tenantId: string,
  patch: Partial<TenantSettings>,
): Promise<void> {
  await db
    .insert(cemTenantSettings)
    .values({
      tenant_id: tenantId,
      scripture_enabled: patch.scripture_enabled,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: cemTenantSettings.tenant_id,
      set: {
        ...(patch.scripture_enabled !== undefined && {
          scripture_enabled: patch.scripture_enabled,
        }),
        updated_at: new Date(),
      },
    });
}
