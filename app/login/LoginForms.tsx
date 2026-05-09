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
    <div className="grid w-full max-w-[420px] gap-6">
      {/* ── Password form ─────────────────────────────────────────── */}
      <form action={pwSubmit} className="grid gap-3">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        {/* Airbnb-style grouped field stack: one bordered container
            with two stacked inputs sharing a divider. */}
        <div className="overflow-hidden rounded-xl border border-cal-border bg-cal-bg transition-colors focus-within:border-cal-accent focus-within:ring-2 focus-within:ring-cal-accent/15">
          <FloatingField label="Email">
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder=" "
              className={floatingInputClasses + " rounded-t-xl"}
            />
          </FloatingField>
          <div className="h-px bg-cal-border" aria-hidden="true" />
          <FloatingField label="Password">
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder=" "
              className={floatingInputClasses + " rounded-b-xl"}
            />
          </FloatingField>
        </div>

        <button
          type="submit"
          disabled={pwPending}
          className="mt-1 inline-flex h-12 items-center justify-center rounded-xl bg-cal-brand px-4 text-[15px] font-semibold text-cal-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {pwPending ? "Signing in…" : "Sign in"}
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

      {/* ── Divider with "or" ─────────────────────────────────────── */}
      <div
        role="separator"
        aria-label="or"
        className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.08em] text-cal-text-muted"
      >
        <span className="h-px flex-1 bg-cal-border" aria-hidden="true" />
        or
        <span className="h-px flex-1 bg-cal-border" aria-hidden="true" />
      </div>

      {/* ── Magic link form ───────────────────────────────────────── */}
      <form action={mlSubmit} className="grid gap-3">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div className="overflow-hidden rounded-xl border border-cal-border bg-cal-bg transition-colors focus-within:border-cal-accent focus-within:ring-2 focus-within:ring-cal-accent/15">
          <FloatingField label="Email for sign-in link">
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder=" "
              className={floatingInputClasses + " rounded-xl"}
            />
          </FloatingField>
        </div>

        <button
          type="submit"
          disabled={mlPending}
          className="mt-1 inline-flex h-12 items-center justify-center rounded-xl bg-[color:var(--cal-bg-subtle)] px-4 text-[14px] font-medium text-cal-text transition-colors hover:bg-[color:var(--cal-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {mlPending ? "Sending…" : "Send me a sign-in link"}
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

/*
 * Airbnb-style floating-label field.
 *
 * The input has placeholder=" " (single space, not empty string!) so
 * the :placeholder-shown selector reliably targets the empty state.
 * That selector + peer-focus drives the label's translate + scale.
 *
 * peer/peer-focus pattern: input is `peer`; the <span> label reacts
 * to the input's focus & placeholder-shown state via Tailwind's
 * peer-* selectors, so the label "floats" up when typing or focused.
 */
const floatingInputClasses =
  "peer block h-14 w-full bg-transparent px-4 pt-5 pb-1 text-[15px] text-cal-text placeholder-shown:pt-3.5 placeholder-shown:pb-3.5 placeholder:text-transparent focus:outline-none";

function FloatingField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      {children}
      <span
        className="pointer-events-none absolute left-4 top-2 text-[10px] font-medium uppercase tracking-[0.06em] text-cal-text-muted transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[14px] peer-placeholder-shown:font-normal peer-placeholder-shown:tracking-normal peer-placeholder-shown:normal-case peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-medium peer-focus:uppercase peer-focus:tracking-[0.06em] peer-focus:text-cal-text-secondary"
      >
        {label}
      </span>
    </label>
  );
}
