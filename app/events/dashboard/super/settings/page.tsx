// Tenant settings — Custom Domain Management (F20). Super Admin only.
//
// SECURITY:
// - requireAuth() + role check; non-super redirect to /no-access.
// - All write actions are server actions that re-validate the session
//   independently. The domain shapes are validated both at the data
//   layer and via Zod in the action layer.

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listDomains } from "@/lib/cem/domains";
import { DomainsClient } from "./DomainsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireAuth();
  if (session.role !== "superadmin" && session.role !== "platform_admin") {
    redirect("/no-access");
  }
  const domains = await listDomains(session.tenantId);
  const cnameTarget = process.env.APP_VERCEL_HOSTNAME ?? "cname.vercel-dns.com";
  return (
    <DomainsClient
      domains={domains}
      tenantSlug={session.tenantSlug}
      cnameTarget={cnameTarget}
    />
  );
}
