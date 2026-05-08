// Root redirects to /events — Calendar is the canonical landing per
// PRD Section 13's routing model. F21 (Tenant App Launcher) will
// replace this with an app-picker for the platform domain; for now
// we just hand the visitor over to CEM.

import { redirect } from "next/navigation";

export default function RootIndex() {
  redirect("/events");
}
