// Tenant settings — preferences + custom domains. Super Admin only.
//
// SECURITY:
// - requireAuth() + role check; non-super redirect to /no-access.
// - All write actions are server actions that re-validate the session
//   independently.

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listDomains } from "@/lib/cem/domains";
import { getTenantSettings } from "@/lib/cem/tenant-settings";
import { DomainsClient } from "./DomainsClient";
import { PreferencesPanel } from "./PreferencesPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireAuth();
  if (session.role !== "superadmin" && session.role !== "platform_admin") {
    redirect("/no-access");
  }
  const [domains, settings] = await Promise.all([
    listDomains(session.tenantId),
    getTenantSettings(session.tenantId),
  ]);
  const cnameTarget = process.env.APP_VERCEL_HOSTNAME ?? "cname.vercel-dns.com";
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <header className="mb-8">
        <h1 className="font-display text-[28px] font-medium leading-tight">
          Tenant Settings
        </h1>
        <p className="mt-1 text-[13px] text-cal-text-secondary">
          Manage preferences and custom domains for{" "}
          <strong>{session.tenantSlug}</strong>.
        </p>
      </header>

      <PreferencesPanel scriptureEnabled={settings.scripture_enabled} />

      <div className="mt-8">
        <DomainsClient
          domains={domains}
          tenantSlug={session.tenantSlug}
          cnameTarget={cnameTarget}
          embedded
        />
      </div>
    </div>
  );
}
