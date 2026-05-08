// Supabase admin client (service-role).
//
// Use this ONLY in:
//   - Server-only scripts (e.g. db/seed.ts)
//   - Server Actions / Route Handlers that need to bypass RLS for a
//     specific privileged operation (e.g. admin endpoints)
//
// SECURITY: This client uses the service-role key, which BYPASSES RLS.
// A leak of this key compromises the entire database. Rules:
//   1. NEVER import this file from a Client Component.
//   2. NEVER expose the service-role key to the browser bundle (no
//      NEXT_PUBLIC_ prefix; not present in any "use client" file).
//   3. Use the regular server client (lib/supabase/server.ts) by
//      default. Only reach for admin when an operation genuinely
//      requires bypassing the calling user's RLS context.
//   4. Operations performed via this client should be audit-logged
//      where appropriate (see cem_audit_log).
//
// The factory throws at call-time if SUPABASE_SERVICE_ROLE_KEY is unset,
// rather than at module-init, so build-time analysis (e.g. `next build`
// without the secret in CI) doesn't fail. Callers must handle the error.

import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations (e.g. seed script).",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
