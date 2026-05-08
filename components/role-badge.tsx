// Role badge — used in NavBar, dashboards, and anywhere a role label
// needs to be shown.
//
// Per PRD Section 6 / prototype's ROLES map:
//
//   member       grayscale
//   lead         green
//   admin        amber
//   superadmin   solid black (inverted)
//
// Inline tinted backgrounds intentionally — these don't change in dark
// mode (PRD Section 17 says badge tints adjust slightly but the specific
// per-role colors are unchanged from the prototype).

import type { AccessRole } from "@/lib/auth/access";

type Tone = {
  label: string;
  bg: string;
  text: string;
  border: string;
};

const ROLE_TONES: Record<AccessRole, Tone> = {
  member: { label: "Member", bg: "#f9fafb", text: "#4b5563", border: "#d1d5db" },
  lead: { label: "Lead", bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  admin: { label: "Administrator", bg: "#fefce8", text: "#854d0e", border: "#fde68a" },
  superadmin: { label: "Super Admin", bg: "#111827", text: "#ffffff", border: "#111827" },
  platform_admin: { label: "Platform Admin", bg: "#111827", text: "#ffffff", border: "#111827" },
};

export function RoleBadge({ role }: { role: AccessRole }) {
  const t = ROLE_TONES[role];
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border }}
    >
      {t.label}
    </span>
  );
}
