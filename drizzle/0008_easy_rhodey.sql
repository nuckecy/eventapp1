CREATE TABLE "cem_tenant_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"scripture_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cem_tenant_settings" ADD CONSTRAINT "cem_tenant_settings_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- RLS for cem_tenant_settings.
-- - Public SELECT (login page, anonymous, needs to check whether to
--   render scripture or brand tagline). Settings are not sensitive.
-- - Mutations restricted to platform admins via the application action
--   layer; RLS additionally requires authenticated + member-of-tenant.

ALTER TABLE "cem_tenant_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "cem_tenant_settings_public_select"
ON "cem_tenant_settings"
FOR SELECT
TO public
USING (true);
--> statement-breakpoint

CREATE POLICY "cem_tenant_settings_admin_write"
ON "cem_tenant_settings"
FOR ALL
TO authenticated
USING (
  public.is_platform_admin()
  OR tenant_id IN (SELECT public.user_tenant_ids())
)
WITH CHECK (
  public.is_platform_admin()
  OR tenant_id IN (SELECT public.user_tenant_ids())
);