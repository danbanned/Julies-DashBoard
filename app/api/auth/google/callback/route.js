// OAuth callback (9a): exchange the code, store tokens on Julie's user row,
// then finish the add-to-calendar she originally clicked (state = eventId)
// and bounce back to the dashboard with a status flag.
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/session";
import { storeTokensFromCode, insertCalendarEvent } from "../../../../../lib/googleCalendar";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const eventId = req.nextUrl.searchParams.get("state") || "";
  // Julie's dashboard lives at /admin now (12b)
  const back = (flag) => NextResponse.redirect(`${origin}/admin?gcal=${flag}`);

  const admin = await requireAdmin();
  if (!admin) return NextResponse.redirect(`${origin}/login`);
  const CURRENT_USER_ID = admin.id;

  if (!code) return back("error");

  try {
    await storeTokensFromCode(CURRENT_USER_ID, code, `${origin}/api/auth/google/callback`);
  } catch (e) {
    console.error("[gcal] token exchange failed:", e.message);
    return back("error");
  }

  // Complete the pending add, if one triggered this flow.
  if (eventId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: CURRENT_USER_ID } });
      const row = await prisma.eventInteraction.findUnique({
        where: { userId_eventId: { userId: CURRENT_USER_ID, eventId } },
      });
      if (row && !row.calendarEventId) {
        const calendarEventId = await insertCalendarEvent(user, row);
        await prisma.eventInteraction.update({
          where: { userId_eventId: { userId: CURRENT_USER_ID, eventId } },
          data: { calendarEventId },
        });
        return back("synced");
      }
    } catch (e) {
      console.error("[gcal] post-connect add failed:", e.message);
      return back("connected"); // connected fine; the add can be retried
    }
  }
  return back("connected");
}
