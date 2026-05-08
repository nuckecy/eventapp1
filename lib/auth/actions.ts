"use server";

// Logout server action. Use from any "use client" component:
//
//   import { signOutAction } from "@/lib/auth/actions";
//   <form action={signOutAction}><button>Sign out</button></form>
//
// SECURITY: Server Actions in Next.js 15 enforce same-origin via the
// built-in Origin header check, so no CSRF token is needed for
// first-party form posts.

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
