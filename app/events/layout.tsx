// CEM (Church Event Management) layout. Wraps all /events/* pages with
// the application nav bar.
//
// F21 update: gate the entire CEM surface on tenant enablement. If the
// resolved tenant doesn't have CEM in core_tenant_apps (or has it
// disabled), we redirect to the launcher with `?unavailable=cem`. The
// launcher will render an info banner. This is the second layer of
// the F21 acceptance criterion ("Each app checks access on mount") —
// the launcher's "Not available" tile is the cosmetic first layer,
// but typing /events directly is also caught here.
//
// We deliberately do NOT gate on user role. The CEM surface has both
// public (Calendar / Holidays / Birthdays) and authenticated (dashboards)
// areas; per-page auth is enforced by `requireAuth()` in those pages.

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NavBar } from "@/components/nav/nav-bar";
import { ToastProvider } from "@/components/cem/toast";
import { readTenantContextFromHeaders } from "@/lib/tenant";
import { isAppEnabledForTenant } from "@/lib/cem/tenant-apps";

export default async function EventsLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const tenant = readTenantContextFromHeaders(requestHeaders);
  // If a tenant context is present, gate on CEM enablement. If no
  // tenant header (platform-domain dev mode), stay permissive.
  if (tenant) {
    const enabled = await isAppEnabledForTenant(tenant.tenantId, "cem");
    if (!enabled) {
      redirect("/?unavailable=cem");
    }
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="flex-1">{children}</main>
      </div>
    </ToastProvider>
  );
}
