"use client";

// Birthday self-service bar (F11). Replaces the F10 stub.
//
// Two states:
//   - "Your birthday: <Month> <day>, <year>" with Edit + Show-age toggle
//   - Edit mode: day/month/year dropdowns + Save/Cancel
//
// SECURITY: All writes go through PUT /api/me/birthday. The endpoint
// takes userId from the session, never from this client. We don't
// pass userId in the request body — the route handler ignores it
// even if we did.

import { User } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type BirthdayState = {
  day: number | null;
  month: number | null;
  year: number | null;
  show_age: boolean;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1900 + 1 }, (_, i) => CURRENT_YEAR - i);

export function BirthdaySelfService({
  initial,
  userName,
}: {
  initial: BirthdayState;
  userName: string;
}) {
  const router = useRouter();
  const id = useId();
  const [editing, setEditing] = useState(initial.day == null);
  const [state, setState] = useState<BirthdayState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  // Auto-clear notice after 3s.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  async function save() {
    setError(null);
    if (state.day == null || state.month == null) {
      setError("Please choose a day and month.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/birthday", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          day: state.day,
          month: state.month,
          year: state.year,
          show_age: state.show_age,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          body.error === "invalid_date"
            ? "That date isn't valid."
            : body.error === "unauthorized"
              ? "Your session expired."
              : "Couldn't save. Try again.",
        );
        return;
      }
      setEditing(false);
      setNotice("Birthday updated");
      // Re-fetch the page so the public list reflects any visibility change.
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function toggleShowAge() {
    if (state.day == null || state.month == null) return;
    const next = !state.show_age;
    setState((s) => ({ ...s, show_age: next }));
    try {
      const res = await fetch("/api/me/birthday", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          day: state.day,
          month: state.month,
          year: state.year,
          show_age: next,
        }),
      });
      if (!res.ok) {
        // Revert on error.
        setState((s) => ({ ...s, show_age: !next }));
        setError("Couldn't update.");
        return;
      }
      setNotice(next ? "Age visible to members" : "Age hidden from others");
      startTransition(() => router.refresh());
    } catch {
      setState((s) => ({ ...s, show_age: !next }));
      setError("Couldn't update.");
    }
  }

  const summary =
    state.day != null && state.month != null
      ? `${MONTHS_LONG[state.month - 1]} ${state.day}${state.year != null ? `, ${state.year}` : ""}`
      : null;

  return (
    <div
      role="region"
      aria-label="Your birthday"
      className="mb-6 rounded-lg border border-cal-border bg-cal-card-bg px-5 py-3.5"
    >
      {!editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[13px] text-cal-text">
            <User className="h-4 w-4 text-cal-text-muted" aria-hidden="true" />
            {summary ? (
              <span>
                Your birthday: <span className="font-medium">{summary}</span>
              </span>
            ) : (
              <span>
                Hi {userName.split(" ")[0]} — set your birthday so the church family can celebrate
                with you.
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {summary ? (
              <label
                htmlFor={`${id}-show-age`}
                className="flex cursor-pointer items-center gap-1.5 text-[11px] text-cal-text-muted"
              >
                <input
                  id={`${id}-show-age`}
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-cal-brand"
                  checked={state.show_age}
                  onChange={toggleShowAge}
                />
                Show my age
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[12px] font-medium text-cal-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
            >
              {summary ? "Edit" : "Set birthday"}
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <User className="h-4 w-4 text-cal-text-muted" aria-hidden="true" />
          <label className="sr-only" htmlFor={`${id}-day`}>
            Day
          </label>
          <select
            id={`${id}-day`}
            value={state.day ?? ""}
            onChange={(e) =>
              setState((s) => ({ ...s, day: e.target.value ? Number(e.target.value) : null }))
            }
            required
            className="rounded-lg border border-cal-border bg-cal-bg px-2 py-1.5 text-[12px] text-cal-text"
          >
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${id}-month`}>
            Month
          </label>
          <select
            id={`${id}-month`}
            value={state.month ?? ""}
            onChange={(e) =>
              setState((s) => ({ ...s, month: e.target.value ? Number(e.target.value) : null }))
            }
            required
            className="rounded-lg border border-cal-border bg-cal-bg px-2 py-1.5 text-[12px] text-cal-text"
          >
            <option value="">Month</option>
            {MONTHS_LONG.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${id}-year`}>
            Year (optional)
          </label>
          <select
            id={`${id}-year`}
            value={state.year ?? ""}
            onChange={(e) =>
              setState((s) => ({ ...s, year: e.target.value ? Number(e.target.value) : null }))
            }
            className="rounded-lg border border-cal-border bg-cal-bg px-2 py-1.5 text-[12px] text-cal-text"
          >
            <option value="">Year (optional)</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-cal-text-muted">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-cal-brand"
              checked={state.show_age}
              onChange={(e) => setState((s) => ({ ...s, show_age: e.target.checked }))}
            />
            Show my age
          </label>
          <div className="ml-auto flex gap-2">
            <button
              type="submit"
              disabled={saving || pending}
              className="inline-flex h-8 items-center rounded-lg bg-cal-brand px-3 text-[12px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
                setState(initial);
              }}
              disabled={saving}
              className="inline-flex h-8 items-center rounded-lg border border-cal-border bg-transparent px-3 text-[12px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-[color:var(--cal-status-deleted-text)]">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="mt-2 text-[12px] text-[color:var(--cal-status-approved-text)]"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
