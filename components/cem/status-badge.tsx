// Bordered status badge per PRD Section 6.

import { STATUS_STYLES, type RequestStatus } from "@/lib/cem/types";

export function StatusBadge({ status }: { status: RequestStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-0.5 text-[11px] font-medium"
      style={{ color: s.text, backgroundColor: s.bg, borderColor: s.border }}
    >
      {s.label}
    </span>
  );
}
