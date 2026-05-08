// Magic-link / OAuth callback.
//
// Supabase redirects the user here after they click an email link.
// The query string carries a `code` parameter that we exchange for a
// session cookie via `exchangeCodeForSession`.
//
// SECURITY:
// - The `next` parameter is validated to be a same-origin path before
//   we redirect to it. No open redirects.
// - On any error we redirect to /login with a generic message — we
//   never expose Supabase's raw error to the user.
// - The exchange happens server-side; the auth code never reaches the
//   browser.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?e=missing_code", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?e=invalid_code", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
