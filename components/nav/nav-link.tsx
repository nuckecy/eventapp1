"use client";

// Single nav link — uses usePathname() to render the active state
// (weight 600 + 2px brand-color underline) per PRD Section 6.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  matchPrefix,
}: {
  href: string;
  label: string;
  /** When true, an active state is shown for any path that starts with `href`.
   *  Useful for /events/dashboard where the user might be on /lead, /admin etc. */
  matchPrefix?: boolean;
}) {
  const pathname = usePathname();
  const isActive = matchPrefix
    ? pathname === href || pathname.startsWith(`${href}/`)
    : pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-1 border-b-2 px-0 py-1.5 text-[13px] transition-colors",
        // Sit on the bottom edge of the 52px nav so the underline aligns.
        "-mb-px",
        isActive
          ? "border-cal-brand font-semibold text-cal-text"
          : "border-transparent font-normal text-cal-text-muted hover:text-cal-text",
      )}
    >
      {label}
    </Link>
  );
}
