// Design tokens demo — visual verification of every token defined in
// PRD Section 6 + the typography rules. This route is the F04
// acceptance check: open it in light + dark mode, confirm everything
// matches the prototype, then move on to F05.
//
// This page is intentionally not part of the application's user-facing
// flow. It's a developer reference. Keep it around through F04-F06 in
// case styles drift; remove later if it stops being useful.

import { ThemeToggle } from "@/components/theme-toggle";

const colorTokens = [
  ["--cal-bg", "Page background"],
  ["--cal-bg-subtle", "Subtle hover / surface"],
  ["--cal-bg-muted", "Muted surface"],
  ["--cal-bg-emphasis", "Emphasised border / divider"],
  ["--cal-bg-inverted", "Inverted (dark in light, light in dark)"],
  ["--cal-text", "Primary text"],
  ["--cal-text-secondary", "Secondary text"],
  ["--cal-text-muted", "Muted text"],
  ["--cal-border", "Default border"],
  ["--cal-border-subtle", "Subtle border"],
  ["--cal-brand", "Brand (grayscale, NOT blue)"],
  ["--cal-accent", "Accent — links, focus rings"],
  ["--cal-card-bg", "Card background"],
];

const eventTypes: Array<{ name: string; var: string; hex: string }> = [
  { name: "Sunday", var: "--cal-event-sunday", hex: "#0d9488" },
  { name: "Regional", var: "--cal-event-regional", hex: "#7c3aed" },
  { name: "Local", var: "--cal-event-local", hex: "#111827" },
];

const statusBadges = [
  { label: "Draft", bg: "var(--cal-status-draft-bg)", text: "var(--cal-status-draft-text)", border: "var(--cal-status-draft-border)" },
  { label: "Submitted", bg: "var(--cal-status-submitted-bg)", text: "var(--cal-status-submitted-text)", border: "var(--cal-status-submitted-border)" },
  { label: "Under Review", bg: "var(--cal-status-review-bg)", text: "var(--cal-status-review-text)", border: "var(--cal-status-review-border)" },
  { label: "Ready for Approval", bg: "var(--cal-status-ready-bg)", text: "var(--cal-status-ready-text)", border: "var(--cal-status-ready-border)" },
  { label: "Approved", bg: "var(--cal-status-approved-bg)", text: "var(--cal-status-approved-text)", border: "var(--cal-status-approved-border)" },
  { label: "Returned", bg: "var(--cal-status-returned-bg)", text: "var(--cal-status-returned-text)", border: "var(--cal-status-returned-border)" },
  { label: "Deleted", bg: "var(--cal-status-deleted-bg)", text: "var(--cal-status-deleted-text)", border: "var(--cal-status-deleted-border)" },
];

const holidayTypes = [
  { label: "PUBLIC HOLIDAY", bg: "var(--cal-holiday-public-bg)", text: "var(--cal-holiday-public-text)", border: "var(--cal-holiday-public-border)" },
  { label: "CHURCH", bg: "var(--cal-holiday-church-bg)", text: "var(--cal-holiday-church-text)", border: "var(--cal-holiday-church-border)" },
  { label: "SPECIAL", bg: "var(--cal-holiday-special-bg)", text: "var(--cal-holiday-special-text)", border: "var(--cal-holiday-special-border)" },
];

const landmarks = [
  { label: "Turning 30", bg: "var(--cal-landmark-young-bg)", text: "var(--cal-landmark-young-text)", border: "var(--cal-landmark-young-border)" },
  { label: "Turning 70", bg: "var(--cal-landmark-senior-bg)", text: "var(--cal-landmark-senior-text)", border: "var(--cal-landmark-senior-border)" },
];

export const metadata = { title: "Design tokens · Church Event Management" };

export default function DesignTokensPage() {
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-12">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-12 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[28px] font-medium leading-tight">
            Design tokens
          </h1>
          <p className="mt-1 text-[13px] text-cal-text-secondary">
            Cal.com Pure theme — visual reference for F04. Toggle light / dark to verify both modes.
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* ── Typography sample ──────────────────────────────────────── */}
      <Section title="Typography" subtitle="Cal Sans (display) + Inter (body). Max weight 500 except micro labels at 600.">
        <div className="space-y-2 rounded-lg border border-cal-border bg-cal-card-bg p-6">
          <p className="font-display text-[28px] font-medium leading-tight">Display 28 / 500 — H1</p>
          <p className="font-display text-[20px] font-medium leading-snug">Title 20 / 500 — H2</p>
          <p className="text-[13px] font-medium">Body 13 / 500 — event title</p>
          <p className="text-[13px]">Body 13 / 400 — table row</p>
          <p className="text-[12px] text-cal-text-secondary">Body 12 / 400 — secondary meta</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
            Label 11 / 500 — section label
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-cal-text-secondary">
            Micro 10 / 600 — table header / day abbr
          </p>
        </div>
      </Section>

      {/* ── Color tokens ───────────────────────────────────────────── */}
      <Section title="Color tokens" subtitle="The 13 grayscale-and-accent tokens that drive the entire app.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {colorTokens.map(([token, label]) => (
            <div
              key={token}
              className="overflow-hidden rounded-lg border border-cal-border"
            >
              <div
                className="h-16 w-full"
                style={{ backgroundColor: `var(${token})`, borderBottom: "1px solid var(--cal-border)" }}
              />
              <div className="p-3">
                <code className="block font-mono text-[11px] text-cal-text">{token}</code>
                <p className="mt-1 text-[11px] text-cal-text-muted">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Event types ────────────────────────────────────────────── */}
      <Section title="Event type colors" subtitle="3px color bars on event rows; full-color chips on the calendar grid.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {eventTypes.map((t) => (
            <div key={t.name} className="rounded-lg border border-cal-border bg-cal-card-bg p-4">
              <div
                className="mb-3 h-1.5 w-12 rounded-full"
                style={{ backgroundColor: `var(${t.var})` }}
              />
              <p className="text-[13px] font-medium">{t.name}</p>
              <p className="mt-1 text-[11px] text-cal-text-muted">{t.hex}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Status badges ──────────────────────────────────────────── */}
      <Section title="Status badges" subtitle="Used in dashboards. Bordered, tinted background per state.">
        <div className="flex flex-wrap gap-2">
          {statusBadges.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-[12px] font-medium"
              style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
            >
              {s.label}
            </span>
          ))}
        </div>
      </Section>

      {/* ── Holiday types ──────────────────────────────────────────── */}
      <Section title="Holiday type chips">
        <div className="flex flex-wrap gap-2">
          {holidayTypes.map((h) => (
            <span
              key={h.label}
              className="inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
              style={{ backgroundColor: h.bg, color: h.text, borderColor: h.border }}
            >
              {h.label}
            </span>
          ))}
        </div>
      </Section>

      {/* ── Landmark birthday tags ─────────────────────────────────── */}
      <Section title="Landmark birthday tags" subtitle="Blue for 10/20/30/40, green for 50/60/70/80/90.">
        <div className="flex flex-wrap gap-2">
          {landmarks.map((l) => (
            <span
              key={l.label}
              className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-[12px] font-medium"
              style={{ backgroundColor: l.bg, color: l.text, borderColor: l.border }}
            >
              {l.label}
            </span>
          ))}
        </div>
      </Section>

      {/* ── Buttons ────────────────────────────────────────────────── */}
      <Section title="Buttons" subtitle="Primary (brand bg), Outline (border), Ghost (transparent). 8px radius, weight 500.">
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-cal-brand px-3.5 py-2 text-[13px] font-medium text-cal-bg transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2">
            Primary
          </button>
          <button className="rounded-lg border border-cal-border bg-transparent px-3.5 py-2 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2">
            Outline
          </button>
          <button className="rounded-lg bg-transparent px-3.5 py-2 text-[13px] font-medium text-cal-text-secondary transition-colors hover:bg-cal-bg-subtle hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2">
            Ghost
          </button>
          <button
            className="rounded-lg bg-cal-bg-emphasis px-3.5 py-2 text-[13px] font-medium text-cal-text-muted"
            disabled
          >
            Disabled
          </button>
        </div>
      </Section>

      {/* ── Inputs ─────────────────────────────────────────────────── */}
      <Section title="Inputs" subtitle="Inter 14px, 8px radius, focus ring uses --cal-accent.">
        <div className="grid max-w-md gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-cal-text-secondary">
              Email
            </span>
            <input
              type="email"
              placeholder="you@example.com"
              className="rounded-lg border border-cal-border bg-cal-bg px-3.5 py-2.5 text-[14px] text-cal-text placeholder:text-cal-text-muted focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-cal-text-secondary">
              Password
            </span>
            <input
              type="password"
              className="rounded-lg border border-cal-border bg-cal-bg px-3.5 py-2.5 text-[14px]"
            />
          </label>
        </div>
      </Section>

      {/* ── Card with stats ────────────────────────────────────────── */}
      <Section title="StatsRow pattern" subtitle="Single bordered container with vertical dividers. PRD Section 6.">
        <div className="flex divide-x divide-cal-border overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg">
          {[
            { number: "12", label: "All requests", sub: "this quarter" },
            { number: "3", label: "Drafts" },
            { number: "5", label: "Submitted" },
            { number: "4", label: "Approved" },
          ].map((s) => (
            <div key={s.label} className="flex-1 px-5 py-3.5">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[28px] font-normal text-cal-text">
                  {s.number}
                </span>
                <span className="text-[11px] font-normal text-cal-text-muted">{s.label}</span>
              </div>
              {s.sub ? (
                <p className="mt-0.5 text-[10px] font-medium text-cal-text-secondary">{s.sub}</p>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <p className="mt-12 text-[11px] text-cal-text-muted">
        Source: PRD Section 6 (Cal.com Pure). Toggle dark mode (top-right) to verify dark variants.
      </p>
    </main>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-[20px] font-medium">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-[13px] text-cal-text-secondary">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
