// Per-event actions (8d): attended / saved / calendar / view / shared / posted.
// The card posts here; we upsert the EventInteraction (snapshotting key event
// fields so history survives feed churn) and recompute this week's
// achievements so the UI can update in one round trip.
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { sessionUser } from "../../../lib/session";
import { recomputeCurrentWeek } from "../../../lib/achievementsEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ interactions: [] }); // anonymous: nothing stored
  const interactions = await prisma.eventInteraction.findMany({
    where: { userId: user.id },
  });
  return NextResponse.json({ interactions });
}

export async function POST(req) {
  // Anonymous = zero persistence (12a). Saves/attends need an account.
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: "sign in to save events" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { eventId, action, value = true, snapshot = {} } = body;
  if (!eventId || !action) {
    return NextResponse.json({ error: "eventId and action are required" }, { status: 400 });
  }

  const now = new Date();
  const data = {};
  switch (action) {
    case "view":
      break; // views incremented below
    case "attended":
      data.attended = Boolean(value);
      data.attendedAt = value ? now : null;
      break;
    case "saved":
      data.saved = Boolean(value);
      data.savedAt = value ? now : null;
      break;
    case "liked":
      data.liked = Boolean(value);
      data.likedAt = value ? now : null;
      break;
    case "calendar":
      data.addedToCalendar = Boolean(value);
      data.addedToCalendarAt = value ? now : null;
      if (!value) data.calendarEventId = null;
      break;
    case "shared":
      data.shared = true;
      data.sharedAt = now;
      break;
    case "posted":
      data.posted = true;
      data.postedAt = now;
      break;
    default:
      return NextResponse.json({ error: `unknown action "${action}"` }, { status: 400 });
  }

  const snapFields = {
    eventTitle: snapshot.title || "",
    eventStartDate: snapshot.start_date || null,
    eventEndDate: snapshot.end_date || null,
    eventUrl: snapshot.event_url || null,
    location: snapshot.location || null,
    neighborhood: snapshot.neighborhood || null,
    source: snapshot.source || null,
  };

  const interaction = await prisma.eventInteraction.upsert({
    where: { userId_eventId: { userId: user.id, eventId } },
    update: { ...data, ...(action === "view" ? { views: { increment: 1 } } : {}) },
    create: {
      userId: user.id,
      eventId,
      ...snapFields,
      ...data,
      views: action === "view" ? 1 : 0,
    },
  });

  const achievements = await recomputeCurrentWeek(user.id);
  return NextResponse.json({ interaction, achievements });
}
