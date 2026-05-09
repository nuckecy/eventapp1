// Login page (server component).
//
// Reads the optional `?next=` query param and passes it to the client
// forms. If the user is already signed in AND has a role for this
// tenant+app, redirects them straight to their default landing screen
// instead of showing the login form.

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAccess } from "@/lib/auth/access";
import { defaultLandingForRole } from "@/lib/auth/session";
import { readTenantContextFromHeaders } from "@/lib/tenant";
import { LoginForms } from "./LoginForms";
import { DailyScripturePanel } from "./DailyScripturePanel";
import { getTenantSettings } from "@/lib/cem/tenant-settings";

type SearchParams = Promise<{ next?: string; e?: string }>;

export const metadata = {
  title: "Sign in | Church Event Management",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const tenant = readTenantContextFromHeaders(requestHeaders);

  // If already signed in and has access, skip the form.
  if (tenant) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const access = await checkAccess(user.id, tenant.tenantSlug, "cem");
      if (access.allowed) {
        redirect(params.next ?? defaultLandingForRole(access.role));
      }
    }
  }

  // Map the `e` param from the auth callback to a friendly notice.
  const callbackError =
    params.e === "missing_code"
      ? "Sign-in link was missing required information. Please request a new one."
      : params.e === "invalid_code"
        ? "Sign-in link is no longer valid. Please request a new one."
        : null;

  // Resolve scripture toggle for the current tenant. No tenant context
  // (marketing apex serves /login? — actually no, the apex has its
  // own landing) → fall back to the global default (enabled).
  const scriptureEnabled = tenant
    ? (await getTenantSettings(tenant.tenantId)).scripture_enabled
    : true;

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left: form panel. Stays on cal-bg so dark mode still works. */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cal-brand text-cal-bg font-display text-[16px] font-medium"
            >
              C
            </span>
            <span className="font-display text-[16px] font-medium tracking-[-0.01em] text-cal-text">
              Church Events
            </span>
          </div>

          <h1 className="font-display text-[32px] font-medium leading-tight tracking-[-0.01em]">
            Welcome back
          </h1>
          <p className="mb-8 mt-1.5 text-[14px] text-cal-text-secondary">
            Sign in to manage events, requests, and your community.
          </p>

          {callbackError ? (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-[color:var(--cal-status-deleted-border)] bg-[color:var(--cal-status-deleted-bg)] px-3 py-2 text-[12px] text-[color:var(--cal-status-deleted-text)]"
            >
              {callbackError}
            </p>
          ) : null}

          <LoginForms next={params.next} />

          {/* Quiet footer link back to home. On a tenant subdomain
              `/` is the launcher; on bare localhost it redirects to
              /events. */}
          <p className="mt-8 text-center text-[13px] text-cal-text-muted">
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-sm text-cal-text-secondary underline-offset-4 transition-colors hover:text-cal-text hover:underline focus-visible:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Back to home
            </Link>
          </p>
        </div>
      </section>

      {/* Right: gradient-mesh art panel. Hidden on small screens.
          Pure CSS — no network requests, scales to any resolution.
          Three radial gradients layered over a base for soft depth. */}
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden lg:block"
        style={{
          backgroundColor: "#1e1b4b",
          backgroundImage: [
            // upper-left teal blob
            "radial-gradient(ellipse 60% 50% at 20% 25%, rgba(13, 148, 136, 0.55), transparent 60%)",
            // mid-right violet blob
            "radial-gradient(ellipse 70% 60% at 85% 50%, rgba(124, 58, 237, 0.55), transparent 60%)",
            // lower-left brand-ish blue blob
            "radial-gradient(ellipse 60% 50% at 15% 90%, rgba(59, 130, 246, 0.45), transparent 60%)",
            // top-right warm accent
            "radial-gradient(ellipse 40% 35% at 90% 10%, rgba(244, 114, 182, 0.35), transparent 60%)",
          ].join(", "),
        }}
      >
        {/* Subtle grain via SVG noise to break up gradient banding. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />

        {/* Right panel content: scripture (if enabled for this
            tenant) or a quiet brand tagline. The toggle defaults
            to ON so unconfigured tenants get the lively experience. */}
        <div className="relative h-full">
          {scriptureEnabled ? (
            <DailyScripturePanel />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-12">
              <div className="max-w-[480px] text-white">
                <blockquote className="font-display text-[28px] font-medium leading-tight tracking-[-0.01em]">
                  &ldquo;Plan together. Approve together. Celebrate together.&rdquo;
                </blockquote>
                <p className="mt-3 text-[13px] text-white/70">
                  One calendar for your whole community.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}
