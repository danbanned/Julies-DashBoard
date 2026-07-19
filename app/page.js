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
  const visible = [...events, ...manual].filter((e) => !meta[e.id]?.hidden);
  const suggestedIds = Object.values(meta)
    .filter((m) => m.suggested && !m.hidden)
    .map((m) => m.eventId);
  const ideaKeyByEvent = {};
  for (const m of Object.values(meta)) {
    if (m.contentIdeaKey && !m.hidden) ideaKeyByEvent[m.eventId] = m.contentIdeaKey;
  }

  return (
    <ViewerApp
      events={visible}
      suggestedIds={suggestedIds}
      ideas={ideas}
      ideaKeyByEvent={ideaKeyByEvent}
      counts={counts}
      user={user ? { id: user.id, name: user.name, role: user.role } : null}
    />
  );
}
