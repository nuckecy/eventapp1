// Departments page (FR-2).
//
// Public — anyone can view department names + lead names. Email and
// phone are auth-gated per the F08 security checkpoint:
//
//   • Anonymous visitors see a blue "Log in to view contact details"
//     banner at the top, and the contact strip on each card shows a
//     lock icon + the same prompt instead of email/phone.
//   • Authenticated users see the contact details inline.
//
// Server-side enforcement: we choose between listDepartmentsPublic
// (no email/phone selected from the DB) and listDepartmentsAuthenticated
// based on getSession(). The unauthenticated DTO never carries the
// sensitive fields, so even a future code-rendering bug can't expose
// them.

import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { getCurrentTenantId } from "@/lib/cem/events";
import {
  listDepartmentsAuthenticated,
  listDepartmentsPublic,
} from "@/lib/cem/departments";
import { DepartmentCard } from "@/components/cem/department-card";
import { LoginPromptBanner } from "@/components/cem/login-prompt-banner";

export const metadata = { title: "Departments · Church Event Management" };

export default async function DepartmentsPage() {
  const tenantId = await getCurrentTenantId();
  const session = await getSession();
  const isAuthed = session !== null;

  // Path the user should land back on after logging in.
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "/events/departments";

  if (!tenantId) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <h1 className="font-display text-[28px] font-medium">Departments</h1>
        <p className="mt-3 text-[13px] text-cal-text-secondary">
          No tenant context. Visit via a tenant subdomain.
        </p>
      </div>
    );
  }

  // Branch at the query layer so contacts never load when not authed.
  const departments = isAuthed
    ? await listDepartmentsAuthenticated(tenantId)
    : await listDepartmentsPublic(tenantId);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <header className="mb-8 max-w-[480px]">
        <h1 className="font-display text-[28px] font-medium leading-tight">Departments</h1>
        <p className="mt-2 text-[13px] text-cal-text-secondary">
          Our ministry departments and their leads. To request an event, reach out to the
          relevant department lead.
        </p>
      </header>

      {!isAuthed ? <LoginPromptBanner nextPath={pathname} /> : null}

      {departments.length === 0 ? (
        <div className="rounded-lg border border-cal-border bg-cal-card-bg px-6 py-12 text-center text-[13px] text-cal-text-secondary">
          No departments configured yet.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/*
            Two render branches by auth state. Keeping them separate
            (rather than collapsing via spread/`in` checks) makes the
            data flow obvious to future readers and the type-narrowing
            unambiguous.
          */}
          {isAuthed
            ? (departments as Awaited<ReturnType<typeof listDepartmentsAuthenticated>>).map(
                (d) => (
                  <li key={d.id}>
                    <DepartmentCard
                      department={{
                        id: d.id,
                        name: d.name,
                        icon: d.icon,
                        lead_name: d.lead_name,
                      }}
                      contact={{ email: d.email, phone: d.phone }}
                    />
                  </li>
                ),
              )
            : departments.map((d) => (
                <li key={d.id}>
                  <DepartmentCard
                    department={{
                      id: d.id,
                      name: d.name,
                      icon: d.icon,
                      lead_name: d.lead_name,
                    }}
                    contact={null}
                  />
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}
