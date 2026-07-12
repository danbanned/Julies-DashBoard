// Per-event actions (8d): attended / saved / calendar / view / shared / posted.
// The card posts here; we upsert the EventInteraction (snapshotting key event
// fields so history survives feed churn) and recompute this week's
// achievements so the UI can update in one round trip.
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { CURRENT_USER_ID } from "../../../lib/user";
import { recomputeCurrentWeek } from "../../../lib/achievementsEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  const interactions = await prisma.eventInteraction.findMany({
    where: { userId: CURRENT_USER_ID },
  });
  return NextResponse.json({ interactions });
}

export async function POST(req) {
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
    where: { userId_eventId: { userId: CURRENT_USER_ID, eventId } },
    update: { ...data, ...(action === "view" ? { views: { increment: 1 } } : {}) },
    create: {
      userId: CURRENT_USER_ID,
      eventId,
      ...snapFields,
      ...data,
      views: action === "view" ? 1 : 0,
    },
  });

  const achievements = await recomputeCurrentWeek(CURRENT_USER_ID);
  return NextResponse.json({ interaction, achievements });
}
