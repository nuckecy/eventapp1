// Login page (server component).
//
// Reads the optional `?next=` query param and passes it to the client
// forms. If the user is already signed in AND has a role for this
// tenant+app, redirects them straight to their default landing screen
// instead of showing the login form.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAccess } from "@/lib/auth/access";
import { defaultLandingForRole } from "@/lib/auth/session";
import { readTenantContextFromHeaders } from "@/lib/tenant";
import { LoginForms } from "./LoginForms";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center px-6 py-12">
      <h1 className="font-display text-[28px] font-medium leading-tight">Sign in</h1>
      <p className="mb-7 mt-1 text-[13px] text-cal-text-secondary">
        Church Event Management
      </p>
      {callbackError ? (
        <p
          role="alert"
          className="mb-4 max-w-[360px] rounded-lg border border-[color:var(--cal-status-deleted-border)] bg-[color:var(--cal-status-deleted-bg)] px-3 py-2 text-[12px] text-[color:var(--cal-status-deleted-text)]"
        >
          {callbackError}
        </p>
      ) : null}
      <LoginForms next={params.next} />
    </main>
  );
}
