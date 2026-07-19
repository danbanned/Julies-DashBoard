// Server-side data helpers for the two surfaces (Phase 12).
import { prisma } from "./db";

// eventId → total view count (12d). Drives card badges + admin metrics.
export async function viewCountsByEvent() {
  const rows = await prisma.eventView.groupBy({ by: ["eventId"], _count: { eventId: true } });
  const map = {};
  for (const r of rows) map[r.eventId] = r._count.eventId;
  return map;
}

export async function eventMetaMap() {
  const rows = await prisma.eventMeta.findMany();
  const map = {};
  for (const r of rows) map[r.eventId] = r;
  return map;
}

export async function contentIdeas() {
  return prisma.contentIdea.findMany({ orderBy: { sortOrder: "asc" } });
}

// Manual events (12e "Add New Event") in the canonical feed shape.
// includeDrafts=true for the admin console only.
export async function manualEventsAsFeed(includeDrafts = false) {
  const rows = await prisma.manualEvent.findMany({
    where: includeDrafts ? {} : { published: true },
    orderBy: { startDate: "asc" },
  });
  return rows.map((m) => ({
    id: `manual-${m.id}`,
    title: m.title,
    description: m.description || "",
    category: "Julie's event",
    location: m.location || "",
    address: m.address || "",
    fee: "",
    fee_frequency: "",
    start_date: m.startDate,
    end_date: m.endDate || "",
    start_time: m.startTime || "",
    end_time: "",
    days: "",
    neighborhood: m.neighborhood || "Other",
    zip: null,
    ingested_at: m.createdAt.toISOString(),
    priority: "medium",
    lat: null,
    lng: null,
    geoExact: false,
    event_url: m.eventUrl || "",
    has_real_url: Boolean(m.eventUrl),
    image_url: m.imageUrl || "/fallbacks/Philadelphia/city.jpg",
    usedFallback: !m.imageUrl,
    source: "julie",
    new_since_last: false,
    _draft: !m.published,
    _manualId: m.id,
  }));
}
