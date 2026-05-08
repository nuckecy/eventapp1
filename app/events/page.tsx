// Calendar — landing page for /events. Stubbed in F05; replaced by
// the real list/grid views in F06-F07.

export const metadata = { title: "Calendar · Church Event Management" };

export default function CalendarStubPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <h1 className="font-display text-[28px] font-medium">Calendar</h1>
      <p className="mt-1 text-[13px] text-cal-text-secondary">
        List + month-grid views land in F06 / F07.
      </p>
    </div>
  );
}
