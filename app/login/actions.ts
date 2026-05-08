"use server";

// Server actions for /login. Two flows:
//   1. signInWithPassword(email, password) — email/password login
//   2. signInWithMagicLink(email)          — sends a sign-in email
//
// Both flows finish by setting Supabase session cookies via the
// @supabase/ssr server client; the user is then redirected to either
// the original `next` URL or the role-appropriate landing page.
//
// SECURITY:
// - Inputs validated with Zod. Anything malformed is rejected before
//   it reaches Supabase.
// - Generic error messages — never leak whether the email exists, only
//   whether the credentials worked. Section 16 / SECURITY_CHECKLIST
//   "no info leak" rule.
// - Rate limiting: Supabase Auth rate-limits by IP at 30 requests / 5
//   minutes by default for password sign-in. We add an explicit toast
//   on the client if Supabase returns a rate-limit error.
// - CSRF: Server Actions in Next.js 15 already validate the request
//   Origin header; no extra token needed for first-party form posts.
// - `next` URL is redirect-validated to be a same-origin path before
//   we redirect to it. No open redirects.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { defaultLandingForRole } from "@/lib/auth/session";
import { checkAccess } from "@/lib/auth/access";
import { readTenantContextFromHeaders } from "@/lib/tenant";

const passwordSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
  next: z.string().max(2000).optional(),
});

const magicLinkSchema = z.object({
  email: z.string().email().max(254),
  next: z.string().max(2000).optional(),
});

export type LoginFormState = {
  error?: string;
  notice?: string;
};

// ── helpers ──────────────────────────────────────────────────────────

/**
 * Validates a `next` redirect target. We only allow same-origin paths
 * (must start with "/" and not "//" or "/\"). Anything else is dropped
 * and replaced with the role default.
 */
function safeNextPath(raw: string | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}

// ── signInWithPassword ───────────────────────────────────────────────

export async function signInWithPasswordAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = passwordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "Please enter a valid email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.session) {
    // Generic message — don't reveal whether the email exists.
    if (error?.status === 429) {
      return { error: "Too many attempts. Please wait a few minutes and try again." };
    }
    return { error: "Invalid email or password." };
  }

  // Resolve the user's role for this tenant+app to pick a landing
  // screen. Tenant comes from middleware-injected headers.
  const requestHeaders = await headers();
  const tenant = readTenantContextFromHeaders(requestHeaders);
  if (!tenant) {
    // Login submitted from a non-tenant URL. Send to platform root.
    redirect("/");
  }

  const access = await checkAccess(data.user.id, tenant.tenantSlug, "cem");
  if (!access.allowed) {
    // User authenticated but has no role for this tenant+app.
    // Sign them out so we don't leave a half-authorised session.
    await supabase.auth.signOut();
    return { error: "Your account does not have access to this church." };
  }

  const target = safeNextPath(parsed.data.next) ?? defaultLandingForRole(access.role);
  redirect(target);
}

// ── signInWithMagicLink ──────────────────────────────────────────────

export async function signInWithMagicLinkAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = magicLinkSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "Please enter a valid email address." };
  }

  // Build the post-link callback URL. Same-origin only; we read the
  // current host from the request headers.
  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host") ?? "";
  const next = safeNextPath(parsed.data.next) ?? "";
  const callbackUrl = `${protocol}://${host}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: callbackUrl,
      // Don't auto-create accounts on magic link request — only known
      // tenant members get a sign-in email.
      shouldCreateUser: false,
    },
  });

  if (error) {
    if (error.status === 429) {
      return { error: "Too many requests. Please wait a few minutes and try again." };
    }
    // Don't differentiate "user not found" from other failures.
    return {
      notice:
        "If an account exists for this email, a sign-in link has been sent. Check your inbox.",
    };
  }

  return {
    notice:
      "If an account exists for this email, a sign-in link has been sent. Check your inbox.",
  };
}
