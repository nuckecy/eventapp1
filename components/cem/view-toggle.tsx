"use client";

// Pill toggle: List | Calendar. Two options — no sub-toggles inside
// each view, per FR-1 ("No sub-toggle inside Calendar view").
//
// Active state: brand background, white text. Inactive: muted text,
// transparent background. Both share a single rounded pill background
// (--cal-bg-muted).

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type View = "list" | "calendar";

const OPTIONS: Array<{ key: View; label: string }> = [
  { key: "list", label: "List" },
  { key: "calendar", label: "Calendar" },
];

export function ViewToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current: View = searchParams.get("view") === "calendar" ? "calendar" : "list";

  function hrefFor(view: View): string {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "list") params.delete("view");
    else params.set("view", view);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div
      role="tablist"
      aria-label="Calendar view"
      className="inline-flex items-center gap-0.5 rounded-lg bg-cal-bg-muted p-0.5"
    >
      {OPTIONS.map(({ key, label }) => {
        const active = current === key;
        return (
          <Link
            key={key}
            href={hrefFor(key)}
            role="tab"
            aria-selected={active}
            scroll={false}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2 ${
              active
                ? "bg-cal-brand text-cal-bg shadow-sm"
                : "text-cal-text-secondary hover:text-cal-text"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
