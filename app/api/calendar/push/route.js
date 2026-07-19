// Push a planned event to Julie's Google Calendar (9d) using HER OAuth
// tokens from the in-app consent flow. Responses:
//   200 ok / alreadySynced      401 { reconnect: true } → run /api/auth/google
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/session";
import { insertCalendarEvent, ReconnectNeeded } from "../../../../lib/googleCalendar";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const CURRENT_USER_ID = admin.id;
  const { eventId, startTime, endTime } = await req.json().catch(() => ({}));
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: CURRENT_USER_ID } });
  if (!user?.googleConnected) {
    return NextResponse.json({ reconnect: true, error: "Google Calendar not connected" }, { status: 401 });
  }

  const row = await prisma.eventInteraction.findUnique({
    where: { userId_eventId: { userId: CURRENT_USER_ID, eventId } },
  });
  if (!row || !row.addedToCalendar) {
    return NextResponse.json({ error: "event is not on the planning calendar" }, { status: 404 });
  }
  if (row.calendarEventId) {
    return NextResponse.json({ ok: true, alreadySynced: true, calendarEventId: row.calendarEventId });
  }
  if (!row.eventStartDate) {
    return NextResponse.json({ error: "event has no start date" }, { status: 400 });
  }

  try {
    const calendarEventId = await insertCalendarEvent(user, row, startTime, endTime);
    const interaction = await prisma.eventInteraction.update({
      where: { userId_eventId: { userId: CURRENT_USER_ID, eventId } },
      data: { calendarEventId },
    });
    return NextResponse.json({ ok: true, calendarEventId, interaction });
  } catch (e) {
    if (e instanceof ReconnectNeeded || e.code === "RECONNECT") {
      return NextResponse.json({ reconnect: true, error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: String(e.message || e) }, { status: 502 });
  }
}
