// Julie's private dashboard (12b) — ADMIN only, enforced server-side.
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import EventsSection from "../../components/EventsSection";
import { loadEvents } from "../../lib/loadEvents";
import { requireAdmin } from "../../lib/session";
import {
  viewCountsByEvent,
  eventMetaMap,
  contentIdeas,
  manualEventsAsFeed,
  applyImageOverrides,
} from "../../lib/platform";
import { prisma } from "../../lib/db";
import { LAYOUT_OPTIONS } from "../../lib/config";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const { events, pastEvents, chips, dropped, perSource, sourceErrors } = loadEvents();
  console.log(
    `[events] upcoming=${events.length} past=${pastEvents.length} dropped:`,
    JSON.stringify(dropped),
    "perSource:",
    JSON.stringify(perSource)
  );
  // 22d: a source stuck at 0 (and not just having a quiet day) or a file
  // read/parse error needs to be obvious in logs immediately, not discovered
  // days later when Julie asks why a feed feels stale.
  const zeroSources = Object.entries(perSource)
    .filter(([, count]) => count === 0)
    .map(([id]) => id);
  if (zeroSources.length) {
    console.warn(`[events] ZERO events from source(s): ${zeroSources.join(", ")}`);
  }
  if (Object.keys(sourceErrors).length) {
    console.warn(`[events] SOURCE FILE ERRORS:`, JSON.stringify(sourceErrors));
  }

  // Admin console data (12e) — all real or zero, never fabricated.
  // 22.1a: "Total Views"/"Engagement" cards must reflect distinct viewers
  // too, not raw EventView rows, same as viewCountsByEvent() — otherwise a
  // handful of people refreshing the page would read as a traffic spike.
  const [counts, meta, ideas, manual, totalViewsRows, weekViewsRows, posts, siteSetting] = await Promise.all([
    viewCountsByEvent(),
    eventMetaMap(),
    contentIdeas(),
    manualEventsAsFeed(true),
    prisma.$queryRaw`SELECT COUNT(DISTINCT COALESCE("viewerId", "anonId")) AS count FROM "EventView"`,
    prisma.$queryRaw`SELECT COUNT(DISTINCT COALESCE("viewerId", "anonId")) AS count FROM "EventView" WHERE "createdAt" >= ${new Date(Date.now() - 7 * 86400000)}`,
    prisma.post.count(),
    prisma.siteSetting.findUnique({ where: { id: "singleton" } }),
  ]);

  // Layout (data-jw-layout) is per-surface — same DB-first/cookie-fallback
  // pattern as app/admin/crm/page.js, so Julie's saved choice (e.g. Featured
  // Image) persists across devices for her main dashboard too.
  const layoutValues = LAYOUT_OPTIONS.map((o) => o.value);
  const dbLayoutUser = await prisma.user.findUnique({ where: { id: admin.id }, select: { layoutPref: true } });
  const jar = await cookies();
  const cookieLayout = jar.get("jw_layout")?.value;
  const layoutPref = layoutValues.includes(dbLayoutUser?.layoutPref)
    ? dbLayoutUser.layoutPref
    : layoutValues.includes(cookieLayout)
      ? cookieLayout
      : "column";
  const totalViews = Number(totalViewsRows[0]?.count || 0);
  const weekViews = Number(weekViewsRows[0]?.count || 0);

  const allEvents = applyImageOverrides([...events, ...manual.filter((m) => !m._draft)], meta);
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
        streakImageUrl={siteSetting?.streakImageUrl || null}
        layoutPref={layoutPref}
      />
    </>
  );
}
