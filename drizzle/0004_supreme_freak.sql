ALTER TABLE "cem_departments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "cem_events" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "cem_holidays" ADD COLUMN "deleted_at" timestamp;