// DepartmentCard — server component. Renders a department's identity
// (icon + name + lead name) and, if contact details are provided,
// the email + phone block. The auth-gated state is encoded by the
// data shape: pass `contact: null` for the locked view.
//
// Visual: matches the prototype's two-section card. Top section is
// 20px padding with a 40px icon tile. Bottom section is bordered-top
// with --cal-bg-subtle background, contact details (or lock + prompt).

import { Lock, Mail, Phone } from "lucide-react";
import type { DepartmentPublic, DepartmentWithContact } from "@/lib/cem/departments";

type Props = {
  department: DepartmentPublic;
  contact: { email: string | null; phone: string | null } | null;
};

export function DepartmentCard({ department, contact }: Props) {
  return (
    <article className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg transition-colors hover:border-cal-bg-emphasis">
      {/* Top: icon + name + lead */}
      <div className="flex items-center gap-4 px-6 py-5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-cal-bg-muted text-[18px]"
          aria-hidden="true"
        >
          {department.icon ?? "📁"}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[14px] font-medium text-cal-text">{department.name}</h2>
          {department.lead_name ? (
            <p className="m-0 mt-0.5 text-[12px] text-cal-text-secondary">
              {department.lead_name}
            </p>
          ) : null}
        </div>
      </div>

      {/* Bottom: contact or locked */}
      <div className="border-t border-cal-border bg-cal-bg-subtle px-6 py-3">
        {contact ? <ContactDetails contact={contact} /> : <LockedContact />}
      </div>
    </article>
  );
}

function ContactDetails({ contact }: { contact: { email: string | null; phone: string | null } }) {
  if (!contact.email && !contact.phone) {
    // The department has no contact info on file — silently render
    // an empty cell rather than the locked state (which would mislead
    // the user into thinking they need to log in for nothing).
    return (
      <span className="text-[12px] text-cal-text-muted">No contact details on file</span>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
      {contact.email ? (
        <a
          href={`mailto:${contact.email}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-cal-accent transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
        >
          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{contact.email}</span>
        </a>
      ) : null}
      {contact.phone ? (
        <a
          href={`tel:${contact.phone.replace(/\s/g, "")}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-cal-accent transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
        >
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{contact.phone}</span>
        </a>
      ) : null}
    </div>
  );
}

function LockedContact() {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-cal-text-muted">
      <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
      Log in to view contact details
    </div>
  );
}

// Re-export for convenience: the page knows it has either the public
// or authenticated shape and can pass the right pieces in.
export type { DepartmentPublic, DepartmentWithContact };
