CREATE TABLE "cem_scriptures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"default_translation" text DEFAULT 'KJV',
	"theme" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "cem_scriptures" ADD CONSTRAINT "cem_scriptures_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_scriptures" ADD CONSTRAINT "cem_scriptures_created_by_core_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- ── RLS policies for cem_scriptures ─────────────────────────────────
-- The login page is pre-auth, so anonymous visitors MUST be able to
-- SELECT a verse. Mutations are restricted to superadmin (enforced
-- additionally at the application action layer).

ALTER TABLE "cem_scriptures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Public read: anyone (anon or authed) can SELECT scriptures.
-- Tenant scoping is enforced by the application's WHERE clause; a
-- visitor on tenantA.churchplatform.com only ever queries with
-- tenantA's id from middleware-injected headers.
CREATE POLICY "cem_scriptures_public_select"
ON "cem_scriptures"
FOR SELECT
TO public
USING (true);
--> statement-breakpoint

-- Insert/update/delete: only superadmin or platform_admin via the
-- service role key. The application action layer further validates
-- (server-side role check + Zod). Direct PostgREST mutations from a
-- user JWT are blocked.
CREATE POLICY "cem_scriptures_admin_write"
ON "cem_scriptures"
FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());