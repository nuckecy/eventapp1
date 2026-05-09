// Super Admin Dashboard (FR-7).
//
// Auth-gated: superadmin / platform_admin only.

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listAllRequests, superAdminStats } from "@/lib/cem/requests";
import { SuperAdminDashboardClient } from "./SuperAdminDashboardClient";

export const metadata = { title: "Super Admin Dashboard · Church Event Management" };

export default async function SuperAdminDashboardPage() {
  const session = await requireAuth();
  if (session.role !== "superadmin" && session.role !== "platform_admin") {
    redirect("/events");
  }

  const [stats, requests] = await Promise.all([
    superAdminStats(session.tenantId),
    listAllRequests(session.tenantId),
  ]);

  return (
    <SuperAdminDashboardClient
      stats={stats}
      requests={requests}
      isPlatformAdmin={session.role === "platform_admin"}
    />
  );
}
