// Admin unmapped-pool banner — F10 placeholder. F12 will own the
// expandable pool UI with Map/Dismiss actions. For F10 we just show
// the count so admins know how many records await review.
//
// SECURITY: This component is rendered server-side only when the
// caller has confirmed admin role. F12 will additionally enforce
// admin-only on the action endpoints.

import { ChevronDown } from "lucide-react";

export function UnmappedBannerStub({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div
      className="mb-6 flex items-center rounded-lg border px-5 py-2.5"
      style={{
        backgroundColor: "#fffbeb",
        borderColor: "#fde68a",
      }}
    >
      <span
        className="text-[11px] font-medium uppercase tracking-[0.08em]"
        style={{ color: "#d97706" }}
      >
        {count} UNMAPPED
      </span>
      <span
        className="mx-2 text-[11px] font-medium tracking-[0.08em]"
        style={{ color: "#d97706" }}
        aria-hidden="true"
      >
        |
      </span>
      <span className="text-[11px] font-normal" style={{ color: "#92400e" }}>
        Review and map to user accounts (F12)
      </span>
      <ChevronDown
        className="ml-auto h-4 w-4"
        style={{ color: "#d97706" }}
        aria-hidden="true"
      />
    </div>
  );
}
