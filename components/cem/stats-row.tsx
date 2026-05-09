// StatsRow — single bordered container with vertical dividers between
// stats (NOT individual cards). PRD Section 6 / F13.
//
// Layout per cell: number (28px Cal Sans, weight 400) + label
// (11px Inter, weight 400) inline; optional sub-label (10px / 500
// secondary) on a second row.
//
// Clickable stats — passing `href` turns the cell into a Next.js
// <Link> with hover background. Useful in dashboards where a stat
// drills down to a filtered tab.

import Link from "next/link";

export type StatItem = {
  number: number | string;
  label: string;
  /** Optional second-row sub-label, e.g. "this quarter". */
  subLabel?: string;
  /** When provided, the cell becomes a clickable Link. */
  href?: string;
};

export function StatsRow({
  stats,
  ariaLabel = "Statistics",
}: {
  stats: StatItem[];
  ariaLabel?: string;
}) {
  return (
    <dl
      role="group"
      aria-label={ariaLabel}
      className="flex divide-x divide-cal-border overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg"
    >
      {stats.map((s, i) => (
        <Cell key={i} stat={s} />
      ))}
    </dl>
  );
}

function Cell({ stat }: { stat: StatItem }) {
  const inner = (
    <>
      <div className="flex items-baseline gap-2">
        <dt className="font-display text-[28px] font-normal leading-none text-cal-text">
          {stat.number}
        </dt>
        <dd className="text-[11px] font-normal text-cal-text-muted">{stat.label}</dd>
      </div>
      {stat.subLabel ? (
        <p className="mt-0.5 text-[10px] font-medium text-cal-text-secondary">
          {stat.subLabel}
        </p>
      ) : null}
    </>
  );

  const cellClasses =
    "block flex-1 px-5 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-inset";

  if (stat.href) {
    return (
      <Link
        href={stat.href}
        className={`${cellClasses} cursor-pointer hover:bg-cal-bg-subtle`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={cellClasses}>{inner}</div>;
}
