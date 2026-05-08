-- F03: Row-Level Security policies (closes Known Issue #2 from F02).
--
-- This migration enables RLS on every core_* and cem_* table and adds
-- policies that enforce tenant isolation at the database level.
--
-- ARCHITECTURE
--
-- Supabase Auth's JWT carries `auth.uid()` (the auth.users.id, which we
-- mirror into core_users.id). To answer "what tenants does this user
-- belong to?" we look up `core_tenant_users` in each policy. This is a
-- single indexed lookup per query (the (tenant_id, user_id) primary key
-- on core_tenant_users covers it).
--
-- The application code ALSO scopes every cem_* query by `WHERE
-- tenant_id = ?`. RLS is the second layer: even if a query forgets the
-- WHERE clause, RLS will quietly filter to the user's tenants.
--
-- PLATFORM ADMIN BYPASS
--
-- Users with `is_platform_admin = true` need to read across tenants for
-- support work. The helper function `public.is_platform_admin()` is
-- referenced by every "select" policy as an OR clause, so platform
-- admins bypass the tenant filter.
--
-- SERVICE ROLE BYPASS
--
-- The service-role key bypasses RLS entirely (Supabase default). This
-- is intentional and lets the seed script and admin endpoints work.
-- See lib/supabase/admin.ts for the rules around when service-role is
-- allowed.

-- ─────────────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────────────

-- Returns true if the calling user is a platform admin.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.core_users
    WHERE id = auth.uid()
      AND is_platform_admin = true
  );
$$;

-- Returns the set of tenant_ids the calling user belongs to (active
-- membership only). Used in RLS policies to filter rows.
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.core_tenant_users
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Enable RLS on every table
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.core_tenants                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_apps                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_tenant_apps               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_tenant_users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_tenant_user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_tenant_domains            ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cem_departments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cem_events                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cem_requests                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cem_request_feedback           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cem_holidays                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cem_birthdays                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cem_birthdays_unmapped         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cem_audit_log                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cem_notifications              ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- core_* policies
-- ─────────────────────────────────────────────────────────────────────

-- core_tenants: members can read their own tenant. No public write.
CREATE POLICY "core_tenants_read_own"
  ON public.core_tenants FOR SELECT
  USING (
    id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- core_users: a user can always read their own row; platform admins
-- can read any. (Cross-user lookups for things like department leads
-- happen in server-side code with service-role; the public app never
-- needs to read other users' core_users rows directly.)
CREATE POLICY "core_users_read_self_or_admin"
  ON public.core_users FOR SELECT
  USING (id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "core_users_update_self"
  ON public.core_users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- core_apps: catalogue is readable by anyone authenticated.
CREATE POLICY "core_apps_read_all_authed"
  ON public.core_apps FOR SELECT
  USING (auth.role() = 'authenticated');

-- core_tenant_apps: a tenant member can see what apps their tenant has.
CREATE POLICY "core_tenant_apps_read_own_tenant"
  ON public.core_tenant_apps FOR SELECT
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- core_tenant_users: a member can see their own membership rows.
CREATE POLICY "core_tenant_users_read_own"
  ON public.core_tenant_users FOR SELECT
  USING (
    user_id = auth.uid()
    OR tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- core_tenant_user_roles: a member can see their own roles. Anyone in
-- the same tenant can see other members' roles (needed for things like
-- "show admins on the help page").
CREATE POLICY "core_tenant_user_roles_read_in_tenant"
  ON public.core_tenant_user_roles FOR SELECT
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- core_tenant_domains: tenant members can read their own tenant's
-- domains (needed for the settings page in F20).
CREATE POLICY "core_tenant_domains_read_own_tenant"
  ON public.core_tenant_domains FOR SELECT
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- ─────────────────────────────────────────────────────────────────────
-- cem_* policies (template: filter by tenant_id)
-- ─────────────────────────────────────────────────────────────────────

-- cem_departments: read is open to anyone (the public departments page
-- shows names and lead names without auth — contact details are
-- redacted at the application layer per FR-2). Writes only by tenant
-- members; admin-level writes enforced by the application.
CREATE POLICY "cem_departments_read_all"
  ON public.cem_departments FOR SELECT
  USING (true);

CREATE POLICY "cem_departments_write_own_tenant"
  ON public.cem_departments FOR ALL
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  )
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- cem_events: published events are public (calendar is public).
CREATE POLICY "cem_events_read_all"
  ON public.cem_events FOR SELECT
  USING (true);

CREATE POLICY "cem_events_write_own_tenant"
  ON public.cem_events FOR ALL
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  )
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- cem_holidays: public reference data.
CREATE POLICY "cem_holidays_read_all"
  ON public.cem_holidays FOR SELECT
  USING (true);

CREATE POLICY "cem_holidays_write_own_tenant"
  ON public.cem_holidays FOR ALL
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  )
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- cem_requests: the workflow queue. Tenant members only.
CREATE POLICY "cem_requests_tenant_only"
  ON public.cem_requests FOR ALL
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  )
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- cem_request_feedback: scoped via parent request's tenant.
CREATE POLICY "cem_request_feedback_via_request"
  ON public.cem_request_feedback FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.cem_requests r
      WHERE r.id = cem_request_feedback.request_id
        AND (r.tenant_id IN (SELECT public.user_tenant_ids()) OR public.is_platform_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.cem_requests r
      WHERE r.id = cem_request_feedback.request_id
        AND (r.tenant_id IN (SELECT public.user_tenant_ids()) OR public.is_platform_admin())
    )
  );

-- cem_birthdays: read by tenant members (the birthdays page is gated
-- to authenticated users in the prototype too — public/anon view shows
-- only month groupings without the day/year). The year column is
-- protected at the API layer by never including it in SELECT lists.
CREATE POLICY "cem_birthdays_read_tenant"
  ON public.cem_birthdays FOR SELECT
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- A user can update their own birthday row.
CREATE POLICY "cem_birthdays_update_own"
  ON public.cem_birthdays FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins (any tenant member with active access) can insert/delete via
-- the application; we leave the general-write policy to "tenant only"
-- and enforce admin-only at the action layer.
CREATE POLICY "cem_birthdays_write_tenant"
  ON public.cem_birthdays FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

CREATE POLICY "cem_birthdays_delete_tenant"
  ON public.cem_birthdays FOR DELETE
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- cem_birthdays_unmapped: admin-only territory. RLS still scopes by
-- tenant; role enforcement happens at the action layer.
CREATE POLICY "cem_birthdays_unmapped_tenant_only"
  ON public.cem_birthdays_unmapped FOR ALL
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  )
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- cem_audit_log: INSERT-only at the database level (PRD Section 16,
-- rule 5). Members can read their own tenant's log only via dedicated
-- super-admin endpoints, but RLS allows SELECT to keep the application
-- layer simple — UI gates who sees it.
CREATE POLICY "cem_audit_log_read_tenant"
  ON public.cem_audit_log FOR SELECT
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

CREATE POLICY "cem_audit_log_insert_tenant"
  ON public.cem_audit_log FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    OR public.is_platform_admin()
  );

-- No UPDATE or DELETE policies are added → RLS denies them by default
-- (table has RLS enabled, no policy = deny). This enforces the
-- immutability requirement at the database level (Section 16 rule 5;
-- F18 acceptance).

-- cem_notifications: a user only ever sees their own notifications.
CREATE POLICY "cem_notifications_own_only"
  ON public.cem_notifications FOR ALL
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_platform_admin()
  );

-- ─────────────────────────────────────────────────────────────────────
-- Public read for anon role
-- ─────────────────────────────────────────────────────────────────────
--
-- Some pages need to work for unauthenticated visitors (calendar,
-- holidays, departments). The relevant policies above use `USING (true)`
-- which permits anon reads. Anon is also blocked from inserting/
-- updating/deleting because no policy applies for those actions on
-- those tables for the anon role.
--
-- Birthdays page: PRD says public anon visitors see birthdays without
-- year. RLS-side, we currently scope reads to tenant members. F10 will
-- decide whether to widen this (and rely on year-redaction in
-- application code) or keep it tighter and serve a public DTO from a
-- dedicated endpoint.
