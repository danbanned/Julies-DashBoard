// Server-side data helpers for the two surfaces (Phase 12).
import { prisma } from "./db";

// eventId → distinct-viewer count (12d, 22.1a). Drives card badges + admin
// metrics. Counts DISTINCT viewers (logged-in viewerId, else anon cookie
// id), not raw EventView rows — repeat clicks from the same person no
// longer inflate the number. Prisma's query API has no COALESCE/distinct-
// on-expression support, so this needs raw SQL.
export async function viewCountsByEvent() {
  const rows = await prisma.$queryRaw`
    SELECT "eventId", COUNT(DISTINCT COALESCE("viewerId", "anonId")) AS count
    FROM "EventView"
    GROUP BY "eventId"
  `;
  const map = {};
  for (const r of rows) map[r.eventId] = Number(r.count);
  return map;
}

export async function eventMetaMap() {
  const rows = await prisma.eventMeta.findMany();
  const map = {};
  for (const r of rows) map[r.eventId] = r;
  return map;
}

// 21d: apply Julie's per-event cover-photo override (EventMeta.imageUrl) on
// top of the feed's own image — takes priority over both the source photo
// and the neighborhood fallback (21c) when set. `usedFallback` flips back to
// false since this is now an explicit, real photo, not a filler.
export function applyImageOverrides(events, meta) {
  return events.map((e) => {
    const override = meta[e.id]?.imageUrl;
    if (!override) return e;
    return { ...e, image_url: override, usedFallback: false };
  });
}

// 21b: redact subscriber-exclusive events for anonymous requests SERVER-SIDE
// — the viewer page is a client component, so anything left on the event
// object ships in the page's data payload regardless of what the UI chooses
// to render. Blurring the image client-side isn't enough; the real
// title/description/link must never leave the server for a signed-out visitor.
// djb2 — same stable-hash approach as the fallback-image picker in
// normalize.js, used here to build a non-reversible id alias.
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Returns { events, idMap } — idMap has an entry ONLY for events whose id
// changed (real id -> hash alias), so callers can remap any OTHER payload
// that's keyed by event id (view counts, suggested ids, content-idea tags)
// and avoid leaking the real id (which several sources embed the title in)
// through a side channel the redaction itself doesn't touch.
export function redactExclusiveForAnon(events, meta, isSignedIn) {
  if (isSignedIn) return { events, idMap: {} };
  const idMap = {};
  const redacted = events.map((e) => {
    if (!meta[e.id]?.subscriberExclusive) return e;
    const aliasId = `exclusive-${hashStr(e.id)}`;
    idMap[e.id] = aliasId;
    // Several sources have no native id and fall back to a title-embedded one
    // (`${source}-${title}-${date}`, see normalize.js) — redacting the title
    // field alone still leaks it via that id, so swap in a non-reversible
    // hash alias too. Safe to do: the teased card renders no interactive
    // actions, so this id is only ever used as a React list key here.
    return {
      ...e,
      id: aliasId,
      title: "Subscriber exclusive",
      description: "",
      location: "",
      address: "",
      event_url: "",
      has_real_url: false,
      category: "",
    };
  });
  return { events: redacted, idMap };
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
