-- Drop the tenant FK and column. cem_scriptures is now platform-global
-- (one curated list serves every tenant + the platform host). All
-- existing rows are kept; if a tenant had duplicate references in
-- different rows they remain as separate rows in the global set, which
-- is fine — they were just identical references anyway.
ALTER TABLE "cem_scriptures" DROP CONSTRAINT "cem_scriptures_tenant_id_core_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "cem_scriptures" DROP COLUMN "tenant_id";
--> statement-breakpoint

-- Refresh RLS policies. Drop the old tenant-scoped ones and add a
-- pair that match the new global model: anyone (anon or authed) can
-- SELECT; only platform admins can mutate.
DROP POLICY IF EXISTS "cem_scriptures_public_select" ON "cem_scriptures";
--> statement-breakpoint
DROP POLICY IF EXISTS "cem_scriptures_admin_write" ON "cem_scriptures";
--> statement-breakpoint

CREATE POLICY "cem_scriptures_public_select_v2"
ON "cem_scriptures"
FOR SELECT
TO public
USING (true);
--> statement-breakpoint

CREATE POLICY "cem_scriptures_platform_admin_write"
ON "cem_scriptures"
FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());