// Department query helpers — F08.
//
// SECURITY (PRD F08 checkpoint, Section 16 rule 3):
// Email and phone are sensitive contact details. They must NEVER be
// returned to an unauthenticated request. The split-function design
// here makes that explicit at the query layer:
//
//   listDepartmentsPublic(tenantId)         → name, lead_name, icon, id only
//   listDepartmentsAuthenticated(tenantId)  → above + email + phone
//
// The page (`app/events/departments/page.tsx`) chooses which one to
// call based on `getSession()`. Forgetting the auth check at the page
// layer can never accidentally expose contacts because the data isn't
// there in the public DTO.
//
// Tenant scoping (Section 16 rule 4): every query filters by
// `tenant_id`. Drizzle's `eq` is parameter-safe.

import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cemDepartments } from "@/db/schema";

export type DepartmentPublic = {
  id: string;
  name: string;
  icon: string | null;
  lead_name: string | null;
};

export type DepartmentWithContact = DepartmentPublic & {
  email: string | null;
  phone: string | null;
};

/**
 * Public projection — names, leads, icons. No contact details. Safe
 * to render to anonymous visitors.
 */
export async function listDepartmentsPublic(tenantId: string): Promise<DepartmentPublic[]> {
  return db
    .select({
      id: cemDepartments.id,
      name: cemDepartments.name,
      icon: cemDepartments.icon,
      lead_name: cemDepartments.lead_name,
    })
    .from(cemDepartments)
    .where(eq(cemDepartments.tenant_id, tenantId))
    .orderBy(asc(cemDepartments.name));
}

/**
 * Full projection including email + phone. The caller is responsible
 * for verifying the user is authenticated before calling this. The
 * function does not re-check — it trusts the caller — because tenant
 * isolation is the only DB-side guarantee. App-layer auth gates the
 * route-level access.
 */
export async function listDepartmentsAuthenticated(
  tenantId: string,
): Promise<DepartmentWithContact[]> {
  return db
    .select({
      id: cemDepartments.id,
      name: cemDepartments.name,
      icon: cemDepartments.icon,
      lead_name: cemDepartments.lead_name,
      email: cemDepartments.email,
      phone: cemDepartments.phone,
    })
    .from(cemDepartments)
    .where(eq(cemDepartments.tenant_id, tenantId))
    .orderBy(asc(cemDepartments.name));
}
