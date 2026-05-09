// Scripture admin editor — Platform admin only.
//
// SECURITY:
// - requireAuth() + role narrowing. Only platform_admin sees this
//   page; super-admins are redirected because the curated list is
//   PLATFORM-WIDE (one set serves every tenant), not per-tenant.
// - The page lives at /events/dashboard/super/* for nav convenience
//   but the data isn't tenant-scoped — see lib/scripture/index.ts.

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listScriptures, listAvailableTranslations } from "@/lib/scripture";
import { ScripturesClient } from "./ScripturesClient";

export const dynamic = "force-dynamic";

export default async function ScripturesAdminPage() {
  const session = await requireAuth();
  // Platform admin only — scripture is global, not per-tenant.
  if (session.role !== "platform_admin") {
    redirect("/no-access");
  }

  const [rows, translations] = await Promise.all([
    listScriptures(/* includeInactive */ true),
    Promise.resolve(listAvailableTranslations()),
  ]);

  return (
    <ScripturesClient
      rows={rows.map((r) => ({
        ...r,
        created_at: r.created_at?.toISOString() ?? null,
      }))}
      availableTranslations={translations.map((t) => ({
        id: t.id,
        name: t.name,
      }))}
    />
  );
}
