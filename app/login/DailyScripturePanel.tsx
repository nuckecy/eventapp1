"use client";

// Daily Scripture panel — appears on the right half of the login screen.
//
// On mount, fetches a random verse via /api/scripture. The user can:
//   - cycle translations with the floating ‹ › chevrons
//   - request a different verse with the ↻ button
//
// Persistence:
//   - The user's last-chosen translation is saved to localStorage as
//     `cem.scripture.translation`. If still in the available list, we
//     load with it on next visit.
//
// Failure modes:
//   - API down → fall through to the FALLBACK_VERSE the data layer
//     hardcodes (provider-side fallback returns John 3:16 WEB).
//   - No providers configured → API returns 503; we render an empty
//     panel with the brand quote so the page never looks broken.

import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cem.scripture.translation";

type ScriptureResponse = {
  reference: string;
  text: string;
  translation: string;
  copyright: string;
  available_translations: Array<{ id: string; name: string }>;
};

type State =
  | { status: "loading" }
  | { status: "ok"; data: ScriptureResponse }
  | { status: "error"; message: string };

export function DailyScripturePanel() {
  const [state, setState] = useState<State>({ status: "loading" });
  // Track current reference so the chevron loads the SAME reference
  // in a different translation rather than picking a new verse.
  const [currentReference, setCurrentReference] = useState<string | null>(null);

  /** Fetch a verse. Pass nothing for "random new", or pin reference to
   *  swap the translation on the same verse. */
  const load = useCallback(
    async (opts: { translation?: string; pinnedRef?: string | null } = {}) => {
      setState({ status: "loading" });
      try {
        const params = new URLSearchParams();
        if (opts.pinnedRef) params.set("ref", opts.pinnedRef);
        if (opts.translation) params.set("tr", opts.translation);
        const res = await fetch(`/api/scripture?${params.toString()}`, {
          // Bypass the browser's HTTP cache so ↻ truly gets a new verse.
          cache: "no-store",
        });
        if (!res.ok) {
          setState({
            status: "error",
            message:
              res.status === 503
                ? "No scripture provider is configured."
                : "Couldn't load scripture.",
          });
          return;
        }
        const data = (await res.json()) as ScriptureResponse;
        setState({ status: "ok", data });
        setCurrentReference(data.reference);
        // Persist the user's translation choice for next visit.
        try {
          localStorage.setItem(STORAGE_KEY, data.translation);
        } catch {
          // localStorage might be disabled (e.g. private browsing).
        }
      } catch {
        setState({ status: "error", message: "Couldn't load scripture." });
      }
    },
    [],
  );

  // Initial load: respect any saved translation preference.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    load({ translation: saved ?? undefined });
  }, [load]);

  function cycleTranslation(direction: 1 | -1) {
    if (state.status !== "ok") return;
    const list = state.data.available_translations;
    if (list.length < 2) return;
    const idx = list.findIndex((t) => t.id === state.data.translation);
    const next = list[(idx + direction + list.length) % list.length];
    load({ translation: next.id, pinnedRef: currentReference });
  }

  function newVerse() {
    load({ translation: state.status === "ok" ? state.data.translation : undefined });
  }

  // Layout-stable inner contents — same heights regardless of state.
  const showChevrons =
    state.status === "ok" && state.data.available_translations.length > 1;

  return (
    <div className="relative flex h-full w-full items-center justify-center px-12">
      {/* Left chevron */}
      {showChevrons ? (
        <button
          type="button"
          onClick={() => cycleTranslation(-1)}
          aria-label="Previous translation"
          disabled={state.status !== "ok"}
          className="absolute left-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}

      {/* Verse */}
      <div className="relative max-w-[480px] text-white">
        {state.status === "loading" ? (
          <p className="font-display text-[26px] font-medium leading-snug tracking-[-0.01em] text-white/40">
            Loading scripture…
          </p>
        ) : state.status === "error" ? (
          <p className="font-display text-[20px] font-medium leading-snug tracking-[-0.01em] text-white/60">
            {state.message}
          </p>
        ) : (
          <>
            <blockquote className="font-display text-[26px] font-medium leading-snug tracking-[-0.01em]">
              {`“${state.data.text}”`}
            </blockquote>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-white/80">
              <span className="font-medium">{state.data.reference}</span>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]">
                {state.data.translation}
              </span>
              <button
                type="button"
                onClick={newVerse}
                aria-label="Show a different verse"
                className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 max-w-[420px] text-[10px] leading-relaxed text-white/40">
              {state.data.copyright}
            </p>
          </>
        )}
      </div>

      {/* Right chevron */}
      {showChevrons ? (
        <button
          type="button"
          onClick={() => cycleTranslation(1)}
          aria-label="Next translation"
          disabled={state.status !== "ok"}
          className="absolute right-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
