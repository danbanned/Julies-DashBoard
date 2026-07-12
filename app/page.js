import EventsSection from "../components/EventsSection";
import { loadEvents } from "../lib/loadEvents";

// Re-read the data files on each request so newly-committed events show up
// without a rebuild. (Vercel/Next will re-run this on demand.)
export const dynamic = "force-dynamic";

export default function Page() {
  const { events, pastEvents, chips, dropped } = loadEvents();

  // Surfaced in server logs so a silently-failing scraper is visible.
  if (typeof console !== "undefined") {
    console.log(
      `[events] upcoming=${events.length} past=${pastEvents.length} dropped:`,
      JSON.stringify(dropped)
    );
  }

  return <EventsSection events={events} pastEvents={pastEvents} chips={chips} />;
}
