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
    <main style={{ padding: 48, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Sign in</h1>
      <p style={{ color: "#6b7280", marginTop: 0, marginBottom: 24, fontSize: 14 }}>
        Church Event Management
      </p>
      {callbackError ? (
        <p
          role="alert"
          style={{
            color: "#991b1b",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 16,
            maxWidth: 360,
          }}
        >
          {callbackError}
        </p>
      ) : null}
      <LoginForms next={params.next} />
    </main>
  );
}
