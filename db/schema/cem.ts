// Church Event Management tables (`cem_` prefix).
// Per PRD Section 11.
//
// SECURITY: Every row is tenant-scoped via `tenant_id`. Every query in
// application code MUST include `WHERE tenant_id = ?`. Drizzle does not
// enforce this — it is the caller's responsibility (Section 16, rule 3).

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { coreTenants, coreUsers } from "./core";

// ── Enums ─────────────────────────────────────────────────────────────

export const cemEventTypeEnum = pgEnum("cem_event_type", ["sunday", "regional", "local"]);

export const cemRequestStatusEnum = pgEnum("cem_request_status", [
  "draft",
  "submitted",
  "under_review",
  "ready_for_approval",
  "approved",
  "returned",
  "deleted",
]);

export const cemHolidayTypeEnum = pgEnum("cem_holiday_type", ["public", "church", "special"]);

// ── cem_departments ───────────────────────────────────────────────────

export const cemDepartments = pgTable("cem_departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => coreTenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"), // emoji or icon key
  // Display name for the lead. Always populated. When `lead_user_id`
  // is set, this is typically the same as that user's `name`; when
  // there's no linked user (text-only contact), this carries the
  // canonical display name on its own. Added in F08.
  lead_name: text("lead_name"),
  lead_user_id: uuid("lead_user_id").references(() => coreUsers.id),
  email: text("email"),
  phone: text("phone"),
  created_at: timestamp("created_at").defaultNow(),
});

// ── cem_events (published, visible on calendar) ───────────────────────

export const cemEvents = pgTable("cem_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => coreTenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: cemEventTypeEnum("type").notNull(),
  date: date("date").notNull(),
  time: text("time"),
  location: text("location"),
  description: text("description"),
  department_id: uuid("department_id").references(() => cemDepartments.id),
  expected_attendance: integer("expected_attendance"),
  budget: integer("budget"),
  source_request_id: uuid("source_request_id"), // FK to cem_requests if created via workflow
  created_by: uuid("created_by").references(() => coreUsers.id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ── cem_requests (event requests in the approval workflow) ────────────

export const cemRequests = pgTable("cem_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => coreTenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: cemEventTypeEnum("type").notNull(),
  date: date("date"),
  time: text("time"),
  location: text("location"),
  description: text("description"),
  department_id: uuid("department_id").references(() => cemDepartments.id),
  expected_attendance: integer("expected_attendance"),
  budget: integer("budget"),
  status: cemRequestStatusEnum("status").default("draft"),
  submitted_by: uuid("submitted_by").references(() => coreUsers.id), // Lead
  claimed_by: uuid("claimed_by").references(() => coreUsers.id), // Admin who claimed
  approved_by: uuid("approved_by").references(() => coreUsers.id), // Super Admin
  submitted_at: timestamp("submitted_at"),
  claimed_at: timestamp("claimed_at"),
  forwarded_at: timestamp("forwarded_at"),
  approved_at: timestamp("approved_at"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ── cem_request_feedback (admin feedback when returning a request) ────

export const cemRequestFeedback = pgTable("cem_request_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  request_id: uuid("request_id")
    .notNull()
    .references(() => cemRequests.id, { onDelete: "cascade" }),
  author_id: uuid("author_id")
    .notNull()
    .references(() => coreUsers.id),
  content: text("content").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ── cem_holidays ──────────────────────────────────────────────────────

export const cemHolidays = pgTable("cem_holidays", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => coreTenants.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  name: text("name").notNull(),
  type: cemHolidayTypeEnum("type").notNull(),
  note: text("note"),
  year: integer("year").notNull(),
});

// ── cem_birthdays (mapped to user accounts) ───────────────────────────
//
// SECURITY (Section 16 rule 6): The `year` column is sensitive. The public
// and authenticated list endpoints must NEVER include it in the response.
// Only `/api/me/birthday` (own data) and `/api/birthdays?admin=true` may
// expose it.

export const cemBirthdays = pgTable("cem_birthdays", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => coreTenants.id, { onDelete: "cascade" }),
  user_id: uuid("user_id")
    .notNull()
    .references(() => coreUsers.id, { onDelete: "cascade" }),
  day: integer("day").notNull(), // 1-31
  month: integer("month").notNull(), // 1-12
  year: integer("year"), // nullable: some users may not want to share
  show_age: boolean("show_age").default(false),
  department_id: uuid("department_id").references(() => cemDepartments.id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ── cem_birthdays_unmapped (legacy data awaiting user mapping) ────────

export const cemBirthdaysUnmapped = pgTable("cem_birthdays_unmapped", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => coreTenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Name from old records
  day: integer("day").notNull(),
  month: integer("month").notNull(),
  year: integer("year"),
  suggest_match_user_id: uuid("suggest_match_user_id").references(() => coreUsers.id),
  suggest_match_name: text("suggest_match_name"), // Display name of suggested match
  suggest_confidence: integer("suggest_confidence"), // 0-100 fuzzy match score
  status: text("status").default("pending"), // "pending", "mapped", "dismissed"
  mapped_to_user_id: uuid("mapped_to_user_id").references(() => coreUsers.id),
  mapped_at: timestamp("mapped_at"),
  mapped_by: uuid("mapped_by").references(() => coreUsers.id), // Admin who mapped
  created_at: timestamp("created_at").defaultNow(),
});

// ── cem_audit_log ─────────────────────────────────────────────────────
//
// SECURITY (Section 16 rule 5; F18 checkpoint): This table is INSERT-only.
// No UPDATE, no DELETE. Enforcement happens in three layers:
//   1. Application code never writes UPDATE/DELETE against this table.
//   2. A revoke statement runs after the migration (see drizzle/migrations/
//      post-migration SQL) restricting the application role to INSERT.
//   3. Code review — every audit-touching change must be checked.
// Verified by SECURITY_TEST.md scan against this file's references.

export const cemAuditLog = pgTable("cem_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => coreTenants.id, { onDelete: "cascade" }),
  actor_id: uuid("actor_id")
    .notNull()
    .references(() => coreUsers.id),
  action: text("action").notNull(), // "request.submitted", "request.claimed", ...
  target_type: text("target_type").notNull(), // "request", "event", "birthday"
  target_id: uuid("target_id").notNull(),
  metadata: text("metadata"), // JSON string with additional context
  created_at: timestamp("created_at").defaultNow(),
});

// ── cem_notifications ─────────────────────────────────────────────────

export const cemNotifications = pgTable("cem_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => coreTenants.id, { onDelete: "cascade" }),
  user_id: uuid("user_id")
    .notNull()
    .references(() => coreUsers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body"),
  type: text("type"), // "request_submitted", "request_claimed", "request_approved", etc.
  reference_type: text("reference_type"), // "request", "event", "birthday"
  reference_id: uuid("reference_id"),
  read: boolean("read").default(false),
  muted: boolean("muted").default(false),
  created_at: timestamp("created_at").defaultNow(),
});
