// Logout endpoint. Accepts POST (preferred — no GET-clears-session
// shenanigans) and clears the Supabase session cookies.
//
// SECURITY:
// - POST only. GET is rejected with 405 to prevent prefetch / image
//   tag / spider triggers from accidentally logging users out.
// - Same-origin enforced via Origin header check (defense in depth on
//   top of Next's built-in CSRF for actions).
// - Redirects to the same-origin /login page; never to user input.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Reject cross-origin POSTs.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: "cross_origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "bad_origin" }, { status: 400 });
    }
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
}
