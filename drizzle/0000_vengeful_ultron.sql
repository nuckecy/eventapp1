CREATE TYPE "public"."app_status" AS ENUM('active', 'inactive', 'beta');--> statement-breakpoint
CREATE TYPE "public"."domain_verification_status" AS ENUM('pending', 'dns_verified', 'active', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'trial');--> statement-breakpoint
CREATE TYPE "public"."cem_event_type" AS ENUM('sunday', 'regional', 'local');--> statement-breakpoint
CREATE TYPE "public"."cem_holiday_type" AS ENUM('public', 'church', 'special');--> statement-breakpoint
CREATE TYPE "public"."cem_request_status" AS ENUM('draft', 'submitted', 'under_review', 'ready_for_approval', 'approved', 'returned', 'deleted');--> statement-breakpoint
CREATE TABLE "core_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "app_status" DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "core_apps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "core_tenant_apps" (
	"tenant_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true,
	"enabled_at" timestamp DEFAULT now(),
	CONSTRAINT "core_tenant_apps_tenant_id_app_id_pk" PRIMARY KEY("tenant_id","app_id")
);
--> statement-breakpoint
CREATE TABLE "core_tenant_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"verification_status" "domain_verification_status" DEFAULT 'pending',
	"verification_token" text,
	"verified" boolean DEFAULT false,
	"ssl_provisioned" boolean DEFAULT false,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"verified_at" timestamp,
	"ssl_provisioned_at" timestamp,
	"added_by" uuid,
	CONSTRAINT "core_tenant_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "core_tenant_user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"role" text NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" uuid
);
--> statement-breakpoint
CREATE TABLE "core_tenant_users" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'active',
	CONSTRAINT "core_tenant_users_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "core_tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"timezone" text DEFAULT 'Europe/Berlin',
	"status" "tenant_status" DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "core_tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "core_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"password_hash" text,
	"is_platform_admin" boolean DEFAULT false,
	"email_verified" boolean DEFAULT false,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "core_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "cem_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cem_birthdays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"day" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer,
	"show_age" boolean DEFAULT false,
	"department_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cem_birthdays_unmapped" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"day" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer,
	"suggest_match_user_id" uuid,
	"suggest_match_name" text,
	"suggest_confidence" integer,
	"status" text DEFAULT 'pending',
	"mapped_to_user_id" uuid,
	"mapped_at" timestamp,
	"mapped_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cem_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"lead_user_id" uuid,
	"email" text,
	"phone" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cem_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "cem_event_type" NOT NULL,
	"date" date NOT NULL,
	"time" text,
	"location" text,
	"description" text,
	"department_id" uuid,
	"expected_attendance" integer,
	"budget" integer,
	"source_request_id" uuid,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cem_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"type" "cem_holiday_type" NOT NULL,
	"note" text,
	"year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cem_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"type" text,
	"reference_type" text,
	"reference_id" uuid,
	"read" boolean DEFAULT false,
	"muted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cem_request_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cem_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "cem_event_type" NOT NULL,
	"date" date,
	"time" text,
	"location" text,
	"description" text,
	"department_id" uuid,
	"expected_attendance" integer,
	"budget" integer,
	"status" "cem_request_status" DEFAULT 'draft',
	"submitted_by" uuid,
	"claimed_by" uuid,
	"approved_by" uuid,
	"submitted_at" timestamp,
	"claimed_at" timestamp,
	"forwarded_at" timestamp,
	"approved_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "core_tenant_apps" ADD CONSTRAINT "core_tenant_apps_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_tenant_apps" ADD CONSTRAINT "core_tenant_apps_app_id_core_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."core_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_tenant_domains" ADD CONSTRAINT "core_tenant_domains_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_tenant_domains" ADD CONSTRAINT "core_tenant_domains_added_by_core_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_tenant_user_roles" ADD CONSTRAINT "core_tenant_user_roles_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_tenant_user_roles" ADD CONSTRAINT "core_tenant_user_roles_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_tenant_user_roles" ADD CONSTRAINT "core_tenant_user_roles_app_id_core_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."core_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_tenant_user_roles" ADD CONSTRAINT "core_tenant_user_roles_assigned_by_core_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_tenant_users" ADD CONSTRAINT "core_tenant_users_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_tenant_users" ADD CONSTRAINT "core_tenant_users_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_audit_log" ADD CONSTRAINT "cem_audit_log_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_audit_log" ADD CONSTRAINT "cem_audit_log_actor_id_core_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_birthdays" ADD CONSTRAINT "cem_birthdays_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_birthdays" ADD CONSTRAINT "cem_birthdays_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_birthdays" ADD CONSTRAINT "cem_birthdays_department_id_cem_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."cem_departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_birthdays_unmapped" ADD CONSTRAINT "cem_birthdays_unmapped_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_birthdays_unmapped" ADD CONSTRAINT "cem_birthdays_unmapped_suggest_match_user_id_core_users_id_fk" FOREIGN KEY ("suggest_match_user_id") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_birthdays_unmapped" ADD CONSTRAINT "cem_birthdays_unmapped_mapped_to_user_id_core_users_id_fk" FOREIGN KEY ("mapped_to_user_id") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_birthdays_unmapped" ADD CONSTRAINT "cem_birthdays_unmapped_mapped_by_core_users_id_fk" FOREIGN KEY ("mapped_by") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_departments" ADD CONSTRAINT "cem_departments_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_departments" ADD CONSTRAINT "cem_departments_lead_user_id_core_users_id_fk" FOREIGN KEY ("lead_user_id") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_events" ADD CONSTRAINT "cem_events_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_events" ADD CONSTRAINT "cem_events_department_id_cem_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."cem_departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_events" ADD CONSTRAINT "cem_events_created_by_core_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_holidays" ADD CONSTRAINT "cem_holidays_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_notifications" ADD CONSTRAINT "cem_notifications_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_notifications" ADD CONSTRAINT "cem_notifications_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_request_feedback" ADD CONSTRAINT "cem_request_feedback_request_id_cem_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."cem_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_request_feedback" ADD CONSTRAINT "cem_request_feedback_author_id_core_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_requests" ADD CONSTRAINT "cem_requests_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_requests" ADD CONSTRAINT "cem_requests_department_id_cem_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."cem_departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_requests" ADD CONSTRAINT "cem_requests_submitted_by_core_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_requests" ADD CONSTRAINT "cem_requests_claimed_by_core_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cem_requests" ADD CONSTRAINT "cem_requests_approved_by_core_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;