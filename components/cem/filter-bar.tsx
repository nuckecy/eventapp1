"use client";

// FilterBar — calendar's search + type chips + department dropdown.
//
// State lives in the URL query string so:
//  - Filtered views are shareable / bookmarkable
//  - The browser back button works
//  - The server component re-runs and re-queries on each filter change
//  - Initial state is server-rendered with no client/server mismatch
//
// Three independent fields:
//   ?q=<search>            — search query
//   ?type=sunday,regional  — comma-separated type list (omit = all)
//   ?dept=<deptId>         — department UUID (omit = all)
//
// Search is debounced (300ms) before pushing the URL change so we
// don't hammer the server on every keystroke.

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { EVENT_TYPES, type EventType } from "@/lib/cem/types";

const TYPE_META: Record<EventType, { label: string; hex: string }> = {
  sunday: { label: "Sunday", hex: "#0d9488" },
  regional: { label: "Regional", hex: "#7c3aed" },
  local: { label: "Local", hex: "#111827" },
};

export type FilterBarDepartment = { id: string; name: string };

export function FilterBar({ departments }: { departments: FilterBarDepartment[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Local search input mirrors ?q so typing feels instant.
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

  // Active type set: ?type=sunday,regional → Set{sunday,regional}.
  // Omit (or empty) = all on (UI default).
  const activeTypes = useMemo<Set<EventType>>(() => {
    const raw = searchParams.get("type");
    if (raw === null) return new Set(EVENT_TYPES);
    if (raw === "") return new Set();
    const requested = raw.split(",").filter((t): t is EventType =>
      (EVENT_TYPES as readonly string[]).includes(t),
    );
    return new Set(requested);
  }, [searchParams]);

  const activeDept = searchParams.get("dept") ?? "";

  // Sync local query state when URL changes externally (e.g. back button).
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  // Helper: replace the URL with new params, preserving everything else.
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

  // Debounce the search input → URL push.
  useEffect(() => {
    if (query === urlQuery) return;
    const t = setTimeout(() => {
      updateParams((p) => {
        if (query.trim()) p.set("q", query.trim().slice(0, 200));
        else p.delete("q");
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query, urlQuery, updateParams]);

  function toggleType(t: EventType) {
    const next = new Set(activeTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);

    updateParams((p) => {
      // If all three are active, drop the param entirely (UI default).
      if (next.size === EVENT_TYPES.length) {
        p.delete("type");
      } else if (next.size === 0) {
        // Empty string = "all off" — preserved so reload doesn't snap
        // back to all-on.
        p.set("type", "");
      } else {
        p.set("type", Array.from(next).join(","));
      }
    });
  }

  function setDept(value: string) {
    updateParams((p) => {
      if (value) p.set("dept", value);
      else p.delete("dept");
    });
  }

  function reset() {
    setQuery("");
    updateParams((p) => {
      p.delete("q");
      p.delete("type");
      p.delete("dept");
    });
  }

  const hasActiveFilters =
    !!urlQuery ||
    !!activeDept ||
    activeTypes.size !== EVENT_TYPES.length;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative min-w-[140px] max-w-[300px] flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cal-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={200}
          placeholder="Search events..."
          aria-label="Search events"
          className="w-full rounded-lg border border-cal-border bg-cal-bg py-1.5 pl-9 pr-3 text-[13px] text-cal-text placeholder:text-cal-text-muted transition-colors hover:border-cal-bg-emphasis focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
        />
      </div>

      {/* Type chips */}
      <div role="group" aria-label="Filter by event type" className="flex items-center gap-1.5">
        {EVENT_TYPES.map((t) => {
          const meta = TYPE_META[t];
          const active = activeTypes.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              aria-pressed={active}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
              style={{
                borderColor: active ? meta.hex : "var(--cal-border)",
                backgroundColor: active ? `${meta.hex}12` : "transparent",
                color: active ? meta.hex : "var(--cal-text-muted)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-sm"
                style={{
                  backgroundColor: meta.hex,
                  opacity: active ? 1 : 0.35,
                }}
                aria-hidden="true"
              />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Department dropdown */}
      <select
        value={activeDept}
        onChange={(e) => setDept(e.target.value)}
        aria-label="Filter by department"
        className="rounded-lg border border-cal-border bg-cal-bg px-3 py-1.5 text-[12px] text-cal-text transition-colors hover:border-cal-bg-emphasis focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {/* Reset link — only when something's active */}
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={reset}
          className="text-[12px] text-cal-text-muted underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
