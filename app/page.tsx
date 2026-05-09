// Apex/launcher router.
//
// This single page serves two distinct surfaces, branched on whether
// the request has tenant context (set by middleware):
//
//   1. NO tenant context (bare apex like `localhost:3000` or
//      `[domain].com`) → MARKETING LANDING. A public, anonymous-
//      friendly hero that links to the demo tenant + signup.
//
//   2. WITH tenant context (e.g. `demo.localhost:3000`,
//      `[tenant].[domain].com`) → TENANT APP LAUNCHER (F21). Cards
//      for every app the platform offers; enabled apps link into
//      the app, disabled apps render as greyed "Not available" tiles.
//
// SECURITY:
// - All queries are tenant-scoped via the middleware-injected headers.
// - App enablement is server-rendered; the launcher's "not available"
//   tile is cosmetic — `app/events/layout.tsx` independently gates
//   the CEM surface on tenant enablement.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Lock, ArrowRight } from "lucide-react";
import { readTenantContextFromHeaders } from "@/lib/tenant";
import { listAppsForTenant } from "@/lib/cem/tenant-apps";
import { getPlatformSession } from "@/lib/auth/session";
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

  // No tenant context → render the marketing landing.
  if (!tenant) {
    return <MarketingLanding />;
  }

  // Demo tenant: skip the launcher entirely. The demo exists to show
  // the product in action — drop visitors straight into the calendar
  // (the most visually engaging surface) rather than make them pick
  // an app card. Real tenants still see the launcher at `/`.
  const sp = await props.searchParams;
  if (tenant.tenantSlug === "demo") {
    redirect("/events");
  }

  // EC-04: launcher is app-agnostic — use the role-less platform
  // session. EC-05: getPlatformSession also verifies tenant
  // membership, so a Tenant-A user landing on Tenant B's launcher
  // sees the generic "Welcome" instead of their own name.
  const [apps, session] = await Promise.all([
    listAppsForTenant(tenant.tenantId),
    getPlatformSession(),
  ]);
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

// ── Marketing Landing ──────────────────────────────────────────────
//
// Rendered when the request has no tenant context (bare apex). This
// is intentionally minimal: a hero, a "see the demo" link to the
// demo tenant, and a "get started" link that will eventually point
// at the signup flow. It's a placeholder — the eventual marketing
// site will likely live as its own project; this gives us something
// real to show today on bare localhost / the platform apex.

function MarketingLanding() {
  // The demo URL is constructed at render time from the current host.
  // In dev this becomes `demo.localhost:PORT`; in prod it would be
  // `demo.[domain].com`. Falls back to `/` if we can't introspect.
  // Note: this is a server component, so we can't read window.location
  // — instead we rely on a relative link and let the host hint the
  // user's browser does the right thing (the demo subdomain is on
  // the same parent host).
  // Land directly on the calendar — the most visually engaging
  // surface — rather than the launcher. (The demo's own `/` already
  // redirects to /events; this skips that hop.)
  const demoHref = "//demo.localhost:3000/events";

  return (
    <main className="min-h-screen bg-cal-bg text-cal-text">
      {/* Top brand bar — minimal, no nav links yet. */}
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cal-brand text-cal-bg font-display text-[16px] font-medium"
          >
            C
          </span>
          <span className="font-display text-[16px] font-medium tracking-[-0.01em]">
            Church Events
          </span>
        </div>
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
        >
          Sign in
        </Link>
      </header>

      {/* Hero. Generous vertical padding; copy intentionally generic
          since the real marketing positioning is still being decided. */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20 pt-16 sm:pt-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cal-text-muted">
          Church management, made simple.
        </p>
        <h1 className="mt-4 max-w-[820px] font-display text-[44px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[56px]">
          One calendar. Every event.
          <br />
          <span className="text-cal-text-secondary">Approved together.</span>
        </h1>
        <p className="mt-6 max-w-[600px] text-[16px] leading-relaxed text-cal-text-secondary">
          Plan, approve, and publish your community&rsquo;s events from a
          single source of truth. Departments, holidays, and birthdays —
          shared with your members. Built for churches.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href={demoHref}
            className="group inline-flex h-12 items-center gap-2 rounded-xl bg-cal-brand px-6 text-[15px] font-semibold text-cal-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
          >
            See the demo
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-xl border border-cal-border bg-transparent px-6 text-[15px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
          >
            Get started
          </Link>
        </div>

        <p className="mt-6 text-[13px] text-cal-text-muted">
          The demo opens in your browser at{" "}
          <code className="rounded bg-cal-bg-subtle px-1.5 py-0.5 font-mono text-[12px]">
            demo.localhost:3000
          </code>
          {" "}— a fully populated example tenant.
        </p>
      </section>

      {/* Quiet footer. Real marketing site will replace this. */}
      <footer className="mx-auto max-w-[1200px] border-t border-cal-border px-6 py-8 text-[12px] text-cal-text-muted">
        <p>Pre-release preview. Marketing site coming soon.</p>
      </footer>
    </main>
  );
}
