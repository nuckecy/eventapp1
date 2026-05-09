// Lead Dashboard (FR-5).
//
// Auth-gated: only Lead+ roles can land here. requireAuth() redirects
// unauthenticated visitors to /login and signed-in users without a
// CEM role to /no-access.

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listDepartmentNames } from "@/lib/cem/events";
import { leadStats, listOwnRequests } from "@/lib/cem/requests";
import { LeadDashboardClient } from "./LeadDashboardClient";

export const metadata = { title: "Lead Dashboard · Church Event Management" };

export default async function LeadDashboardPage() {
  const session = await requireAuth();

  // Members shouldn't see the Lead dashboard.
  if (session.role === "member") {
    redirect("/events");
  }

  const [stats, requests, departments] = await Promise.all([
    leadStats(session.tenantId, session.userId),
    listOwnRequests(session.tenantId, session.userId),
    listDepartmentNames(session.tenantId),
  ]);

  return (
    <LeadDashboardClient
      stats={stats}
      requests={requests}
      departments={departments}
    />
  );
}
