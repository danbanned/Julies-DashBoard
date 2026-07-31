// PUBLIC viewer surface (12c) — the Eventbrite-style directory. Default for
// anonymous visitors and viewers; Julie's dashboard lives at /admin.
// Only public data crosses this boundary: events, picks, content ideas,
// view counts. No admin/private data is loaded here at all.
import ViewerApp from "../components/ViewerApp";
import { loadEvents } from "../lib/loadEvents";
import { sessionUser } from "../lib/session";
import {
  viewCountsByEvent,
  eventMetaMap,
  contentIdeas,
  manualEventsAsFeed,
  applyImageOverrides,
  redactExclusiveForAnon,
} from "../lib/platform";

export const dynamic = "force-dynamic";

export default async function ViewerPage() {
  const [user, counts, meta, ideas, manual] = await Promise.all([
    sessionUser(),
    viewCountsByEvent(),
    eventMetaMap(),
    contentIdeas(),
    manualEventsAsFeed(false),
  ]);
  const { events } = loadEvents();

  // Hidden events never reach the viewer payload (12e "Hide").
  const withOverrides = applyImageOverrides(
    [...events, ...manual].filter((e) => !meta[e.id]?.hidden),
    meta
  ).map((e) => (meta[e.id]?.subscriberExclusive ? { ...e, subscriberExclusive: true } : e));
  // 21b: strip real title/description/link for exclusive events before this
  // ever reaches the client payload — signed-out visitors get the tease only.
  // idMap (real id -> hash alias) lets every OTHER id-keyed payload below get
  // remapped too, so the real id never leaks through a side channel.
  const { events: visible, idMap } = redactExclusiveForAnon(withOverrides, meta, Boolean(user));
  const remapId = (id) => idMap[id] || id;

  const suggestedIds = Object.values(meta)
    .filter((m) => m.suggested && !m.hidden && !idMap[m.eventId]) // exclusive+anon: don't surface in Picks at all
    .map((m) => remapId(m.eventId));
  const ideaKeyByEvent = {};
  for (const m of Object.values(meta)) {
    if (m.contentIdeaKey && !m.hidden && !idMap[m.eventId]) ideaKeyByEvent[m.eventId] = m.contentIdeaKey;
  }
  const remappedCounts = {};
  for (const [id, n] of Object.entries(counts)) remappedCounts[remapId(id)] = n;

  return (
    <ViewerApp
      events={visible}
      suggestedIds={suggestedIds}
      ideas={ideas}
      ideaKeyByEvent={ideaKeyByEvent}
      counts={remappedCounts}
      user={user ? { id: user.id, name: user.name, role: user.role } : null}
    />
  );
}
