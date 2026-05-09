"use client";

// HolidayTypeFilterBar — three pill toggles for the Holidays page.
// State lives in the URL (`?type=public,church,special`) so the
// filtered view is shareable and the back button works. Mirrors the
// EventType chip behavior in F06's FilterBar.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { HOLIDAY_TYPES, type HolidayType } from "@/lib/cem/types";

const TYPE_META: Record<HolidayType, { label: string; text: string; bg: string; border: string }> = {
  public: {
    label: "PUBLIC HOLIDAY",
    text: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
  },
  church: {
    label: "CHURCH",
    text: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
  special: {
    label: "SPECIAL",
    text: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
};

export function HolidayTypeFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeTypes = useMemo<Set<HolidayType>>(() => {
    const raw = searchParams.get("type");
    if (raw === null) return new Set(HOLIDAY_TYPES);
    if (raw === "") return new Set();
    const requested = raw.split(",").filter((t): t is HolidayType =>
      (HOLIDAY_TYPES as readonly string[]).includes(t),
    );
    return new Set(requested);
  }, [searchParams]);

  const updateParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams, startTransition],
  );

  function toggleType(t: HolidayType) {
    const next = new Set(activeTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    updateParams((p) => {
      if (next.size === HOLIDAY_TYPES.length) p.delete("type");
      else if (next.size === 0) p.set("type", "");
      else p.set("type", Array.from(next).join(","));
    });
  }

  return (
    <div role="group" aria-label="Filter by holiday type" className="flex flex-wrap gap-2">
      {HOLIDAY_TYPES.map((t) => {
        const meta = TYPE_META[t];
        const active = activeTypes.has(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggleType(t)}
            aria-pressed={active}
            className="inline-flex items-center rounded-md border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
            style={{
              borderColor: active ? meta.border : "var(--cal-border)",
              backgroundColor: active ? meta.bg : "transparent",
              color: active ? meta.text : "var(--cal-text-muted)",
            }}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
