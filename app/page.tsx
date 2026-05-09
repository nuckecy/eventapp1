// Tenant App Launcher (F21).
//
// When the request resolves to a tenant context (via the middleware-
// injected headers), this page renders cards for every app in the
// platform registry. Apps the tenant has enabled link into the app;
// apps they don't are shown as greyed-out "not available" tiles per
// the F21 acceptance criteria — the user gets a discoverable list,
// not a 404.
//
// When there's no tenant context (visiting the platform apex domain),
// we still redirect to /events as a fallback for v1; that route's
// public surface (Calendar / Holidays / Birthdays) doesn't strictly
// require a tenant header in dev, and will be handled by the platform
// landing in a future release.
//
// SECURITY:
// - All queries are tenant-scoped via the headers — middleware is the
//   only writer of those headers, validated at the edge.
// - App enablement is read server-side; the launcher's "not available"
//   tile is cosmetic. The downstream layout (e.g. /events) checks
//   enablement independently before rendering the app — a user who
//   types the URL directly is redirected back here with the same
//   notice.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Lock } from "lucide-react";
import { readTenantContextFromHeaders } from "@/lib/tenant";
import { listAppsForTenant } from "@/lib/cem/tenant-apps";
import { getSession } from "@/lib/auth/session";
import { NavBar } from "@/components/nav/nav-bar";

// App slug → CEM-style icon + landing-route registry. Keep all routing
// decisions here; data layer just returns slugs.
const APP_REGISTRY: Record<
  string,
  { route: string; icon: typeof Calendar }
> = {
  cem: { route: "/events", icon: Calendar },
  // Future apps would land here.
};

export const dynamic = "force-dynamic";

export default async function LauncherPage(props: {
  searchParams: Promise<{ unavailable?: string }>;
}) {
  const requestHeaders = await headers();
  const tenant = readTenantContextFromHeaders(requestHeaders);

  // Platform domain (no tenant header). For v1 we hand visitors
  // through to the public CEM calendar — the platform landing page
  // is a future feature.
  if (!tenant) {
    redirect("/events");
  }

  const [apps, session] = await Promise.all([
    listAppsForTenant(tenant.tenantId),
    getSession(),
  ]);
  const sp = await props.searchParams;
  const unavailableSlug = typeof sp.unavailable === "string" ? sp.unavailable : null;

  // Sort: enabled apps first, then alphabetical.
  const sorted = [...apps].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="mx-auto max-w-[1200px] px-6 py-12">
          <header className="mb-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-cal-text-secondary">
              {tenant.tenantSlug}
            </p>
            <h1 className="mt-1 font-display text-[32px] font-medium leading-tight">
              Welcome{session?.name ? `, ${session.name.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-2 text-[14px] text-cal-text-secondary">
              Choose an app to continue.
            </p>
          </header>

          {unavailableSlug ? (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-[color:var(--cal-status-pending-border)] bg-[color:var(--cal-status-pending-bg)] px-4 py-3 text-[13px] text-[color:var(--cal-status-pending-text)]"
            >
              The <strong>{appNameFor(apps, unavailableSlug)}</strong> app is not
              available for this tenant. Contact your administrator to enable it.
            </div>
          ) : null}

          {sorted.length === 0 ? (
            <div className="rounded-lg border border-cal-border bg-cal-card-bg px-6 py-16 text-center text-[13px] text-cal-text-muted">
              No apps configured on this platform yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function appNameFor(
  apps: Awaited<ReturnType<typeof listAppsForTenant>>,
  slug: string,
): string {
  return apps.find((a) => a.slug === slug)?.name ?? slug;
}

function AppCard({
  app,
}: {
  app: Awaited<ReturnType<typeof listAppsForTenant>>[number];
}) {
  const meta = APP_REGISTRY[app.slug];
  const Icon = meta?.icon ?? Calendar;

  if (app.enabled && meta) {
    return (
      <Link
        href={meta.route}
        className="group flex flex-col rounded-lg border border-cal-border bg-cal-card-bg p-5 transition-all hover:-translate-y-0.5 hover:border-cal-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-cal-brand/10 text-cal-brand transition-colors group-hover:bg-cal-brand group-hover:text-cal-bg">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[16px] font-medium leading-tight text-cal-text">
              {app.name}
            </div>
            <div className="text-[11px] uppercase tracking-[0.06em] text-cal-text-muted">
              {app.slug}
            </div>
          </div>
        </div>
        {app.description ? (
          <p className="mt-3 text-[12px] leading-snug text-cal-text-secondary">
            {app.description}
          </p>
        ) : null}
      </Link>
    );
  }

  // Disabled or unknown — render as a non-interactive tile, NOT a 404.
  return (
    <div
      aria-disabled="true"
      className="flex cursor-not-allowed flex-col rounded-lg border border-dashed border-cal-border bg-cal-bg-subtle p-5 opacity-70"
      title="Not available for this tenant"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-cal-bg-muted text-cal-text-muted">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[16px] font-medium leading-tight text-cal-text-secondary">
            {app.name}
          </div>
          <div className="text-[11px] uppercase tracking-[0.06em] text-cal-text-muted">
            Not available
          </div>
        </div>
      </div>
      {app.description ? (
        <p className="mt-3 text-[12px] leading-snug text-cal-text-muted">
          {app.description}
        </p>
      ) : null}
    </div>
  );
}
