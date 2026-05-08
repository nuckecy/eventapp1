"use client";

// Login forms — password + magic link.
//
// Visual styling is intentionally minimal here; F04 will replace this
// with Cal.com / Shadcn styling. The structure is what matters: two
// separate <form>s, each bound to its own server action via
// `useActionState` (Next 15 / React 19 hook), with progressive
// enhancement so they work without JS.
//
// SECURITY:
// - Form posts target server actions, which Next.js validates as
//   same-origin (CSRF protection built in).
// - The hidden `next` field carries the post-login redirect target.
//   It's re-validated server-side in actions.ts; client-side it's only
//   for convenience.

import { useActionState } from "react";
import {
  signInWithMagicLinkAction,
  signInWithPasswordAction,
  type LoginFormState,
} from "./actions";

const initialState: LoginFormState = {};

export function LoginForms({ next }: { next?: string }) {
  const [pwState, pwSubmit, pwPending] = useActionState(
    signInWithPasswordAction,
    initialState,
  );
  const [mlState, mlSubmit, mlPending] = useActionState(
    signInWithMagicLinkAction,
    initialState,
  );

  return (
    <div style={{ display: "grid", gap: 32, maxWidth: 360 }}>
      {/* ── Password form ─────────────────────────────────────────── */}
      <form action={pwSubmit} style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Sign in with password</h2>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            style={{ padding: "8px 10px" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            style={{ padding: "8px 10px" }}
          />
        </label>
        <button type="submit" disabled={pwPending} style={{ padding: "8px 12px" }}>
          {pwPending ? "Signing in..." : "Sign in"}
        </button>
        {pwState.error ? (
          <p role="alert" style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>
            {pwState.error}
          </p>
        ) : null}
      </form>

      <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: 0 }} />

      {/* ── Magic link form ───────────────────────────────────────── */}
      <form action={mlSubmit} style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Or get a sign-in link by email</h2>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            style={{ padding: "8px 10px" }}
          />
        </label>
        <button type="submit" disabled={mlPending} style={{ padding: "8px 12px" }}>
          {mlPending ? "Sending..." : "Send me a sign-in link"}
        </button>
        {mlState.notice ? (
          <p role="status" style={{ color: "#166534", fontSize: 13, margin: 0 }}>
            {mlState.notice}
          </p>
        ) : null}
        {mlState.error ? (
          <p role="alert" style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>
            {mlState.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
