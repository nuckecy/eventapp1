// Shown when a signed-in user lacks a role for the current tenant+app.
// Distinct from /login because they don't need to authenticate again —
// they just don't have permission.

import { signOutAction } from "@/lib/auth/actions";

export const metadata = {
  title: "Access denied | Church Event Management",
};

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center px-6 py-12">
      <h1 className="font-display text-[24px] font-medium leading-snug">
        You don&apos;t have access to this church
      </h1>
      <p className="mt-3 text-[13px] leading-relaxed text-cal-text-secondary">
        Your account is signed in, but you have no role assigned for this church or for the
        Event Management app. If you think this is wrong, contact your church administrator.
      </p>
      <form action={signOutAction} className="mt-6">
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-lg border border-cal-border bg-transparent px-3.5 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
