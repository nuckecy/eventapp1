"use client";

// Login forms — password + magic link.
//
// Styled with Cal.com tokens. Uses `useActionState` (Next 15 / React 19)
// for progressive-enhancement form submits — the forms work without JS.
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
    <div className="grid w-full max-w-[360px] gap-7">
      {/* ── Password form ─────────────────────────────────────────── */}
      <form action={pwSubmit} className="grid gap-3">
        <h2 className="m-0 text-[14px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
          Sign in with password
        </h2>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label="Email">
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className={fieldClasses}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className={fieldClasses}
          />
        </Field>
        <button
          type="submit"
          disabled={pwPending}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {pwPending ? "Signing in..." : "Sign in"}
        </button>
        {pwState.error ? (
          <p
            role="alert"
            className="m-0 text-[12px] text-[color:var(--cal-status-deleted-text)]"
          >
            {pwState.error}
          </p>
        ) : null}
      </form>

      <hr className="m-0 border-0 border-t border-cal-border" />

      {/* ── Magic link form ───────────────────────────────────────── */}
      <form action={mlSubmit} className="grid gap-3">
        <h2 className="m-0 text-[14px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
          Or get a sign-in link by email
        </h2>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label="Email">
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className={fieldClasses}
          />
        </Field>
        <button
          type="submit"
          disabled={mlPending}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {mlPending ? "Sending..." : "Send me a sign-in link"}
        </button>
        {mlState.notice ? (
          <p
            role="status"
            className="m-0 text-[12px] text-[color:var(--cal-status-approved-text)]"
          >
            {mlState.notice}
          </p>
        ) : null}
        {mlState.error ? (
          <p
            role="alert"
            className="m-0 text-[12px] text-[color:var(--cal-status-deleted-text)]"
          >
            {mlState.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

const fieldClasses =
  "rounded-lg border border-cal-border bg-cal-bg px-3.5 py-2.5 text-[14px] text-cal-text placeholder:text-cal-text-muted transition-colors hover:border-cal-bg-emphasis focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-cal-text-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}
