// Julie's private dashboard (12b) — ADMIN only, enforced server-side.
import { redirect } from "next/navigation";
import EventsSection from "../../components/EventsSection";
import { loadEvents } from "../../lib/loadEvents";
import { requireAdmin } from "../../lib/session";
import {
  viewCountsByEvent,
  eventMetaMap,
  contentIdeas,
  manualEventsAsFeed,
} from "../../lib/platform";
import { prisma } from "../../lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const { events, pastEvents, chips, dropped } = loadEvents();
  console.log(
    `[events] upcoming=${events.length} past=${pastEvents.length} dropped:`,
    JSON.stringify(dropped)
  );

  // Admin console data (12e) — all real or zero, never fabricated.
  const [counts, meta, ideas, manual, totalViews, weekViews, posts] = await Promise.all([
    viewCountsByEvent(),
    eventMetaMap(),
    contentIdeas(),
    manualEventsAsFeed(true),
    prisma.eventView.count(),
    prisma.eventView.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    }),
    prisma.post.count(),
  ]);

  const allEvents = [...events, ...manual.filter((m) => !m._draft)];
  const consoleData = {
    events: [...allEvents, ...manual.filter((m) => m._draft)],
    meta,
    counts,
    ideas,
    totals: {
      views: totalViews,
      weekViews,
      eventCount: allEvents.length,
      suggested: Object.values(meta).filter((m) => m.suggested).length,
      posts,
    },
  };

  return (
    <>
      {/* photo backdrop is admin-only; the viewer surface is plain cream */}
      <div className="pageBackdrop" />
      <EventsSection
        events={allEvents}
        pastEvents={pastEvents}
        chips={chips}
        consoleData={consoleData}
      />
    </>
  );
}
