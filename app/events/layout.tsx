// CEM (Church Event Management) layout. Wraps all /events/* pages with
// the application nav bar.
//
// Future hook (F21): this layout should also call `checkAccess()` to
// verify (a) the tenant has CEM enabled, and (b) the current user has
// a CEM role. F21 will add that — for now public CEM pages (calendar,
// holidays, etc.) can be viewed without auth, so we keep the layout
// permissive and let individual pages handle their own auth gating.

import type { ReactNode } from "react";
import { NavBar } from "@/components/nav/nav-bar";

export default function EventsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
