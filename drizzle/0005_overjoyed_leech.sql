ALTER TYPE "public"."cem_request_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "cem_events" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "cem_events" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "cem_events" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "cem_events" ADD CONSTRAINT "cem_events_cancelled_by_core_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;