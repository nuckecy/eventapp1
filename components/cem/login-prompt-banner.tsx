// Blue info banner shown to anonymous visitors on the Departments
// page (FR-2). Tinted blue card with lock icon, message, and a Log in
// button. Dark-mode variant uses a deeper navy background and a
// lighter blue text so contrast holds.

import Link from "next/link";
import { Lock } from "lucide-react";

export function LoginPromptBanner({ nextPath }: { nextPath: string }) {
  return (
    <div className="mb-7 flex items-center gap-3 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-5 py-3.5 dark:border-[#1e3a5f] dark:bg-[#172554]">
      <Lock className="h-4 w-4 shrink-0 text-cal-accent" aria-hidden="true" />
      <span className="flex-1 text-[13px] text-[#1e40af] dark:text-[#93c5fd]">
        Log in to view contact details for department leads.
      </span>
      <Link
        href={`/login?next=${encodeURIComponent(nextPath)}`}
        className="inline-flex h-8 shrink-0 items-center rounded-lg bg-cal-brand px-4 text-[12px] font-medium text-cal-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
      >
        Log in
      </Link>
    </div>
  );
}
