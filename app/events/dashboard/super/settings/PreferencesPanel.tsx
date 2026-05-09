"use client";

// Tenant preferences panel — sits at the top of the Settings page.
// Currently exposes one toggle: Daily Scripture on/off. More flags
// will land here over time (notification email, theme, etc.).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { useToast } from "@/components/cem/toast";
import { setScriptureEnabledAction } from "@/lib/cem/tenant-settings-actions";

export function PreferencesPanel({
  scriptureEnabled,
}: {
  scriptureEnabled: boolean;
}) {
  // Optimistic local state — the toggle flips immediately, then the
  // server action runs. On failure we revert + toast.
  const [enabled, setEnabled] = useState(scriptureEnabled);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  async function onToggle(next: boolean) {
    setEnabled(next);
    setBusy(true);
    const r = await setScriptureEnabledAction({ enabled: next });
    setBusy(false);
    if (!r.ok) {
      setEnabled(!next); // revert
      toast.show("error", "Couldn't save. Try again.");
      return;
    }
    toast.show("success", next ? "Scripture enabled." : "Scripture disabled.");
    startTransition(() => router.refresh());
  }

  return (
    <section className="rounded-lg border border-cal-border bg-cal-card-bg p-6">
      <h2 className="font-display text-[18px] font-medium leading-tight">
        Preferences
      </h2>

      <div className="mt-4 flex items-start gap-4 rounded-md border border-cal-border bg-cal-bg-subtle p-4">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cal-bg text-cal-text-secondary"
        >
          <BookOpen className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-cal-text">
            Daily Scripture
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-cal-text-secondary">
            Show a rotating verse on the login page. Visitors can cycle
            through translations and refresh to see another. Disable to
            show a generic welcome tagline instead.
          </p>
        </div>
        <Toggle checked={enabled} onChange={onToggle} disabled={busy} />
      </div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-cal-brand" : "bg-cal-bg-emphasis"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
