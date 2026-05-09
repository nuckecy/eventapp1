// Admin Dashboard (FR-6).
//
// Auth-gated: admin / superadmin / platform_admin only.

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { adminStats, listAllRequests } from "@/lib/cem/requests";
import { AdminDashboardClient } from "./AdminDashboardClient";

export const metadata = { title: "Admin Dashboard · Church Event Management" };

export default async function AdminDashboardPage() {
  const session = await requireAuth();
  if (
    session.role !== "admin" &&
    session.role !== "superadmin" &&
    session.role !== "platform_admin"
  ) {
    redirect("/events");
  }

  const [stats, requests] = await Promise.all([
    adminStats(session.tenantId),
    listAllRequests(session.tenantId),
  ]);

  return <AdminDashboardClient stats={stats} requests={requests} />;
}
