// Engagement tracking (12d): a click/open of an event = one view row.
// Logged-in users tracked by id; anonymous visitors by a random cookie id —
// a tally, not "user data". Anyone may POST; there's nothing to read back.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "../../../lib/db";
import { sessionUser } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { eventId } = await req.json().catch(() => ({}));
  if (!eventId || typeof eventId !== "string" || eventId.length > 200) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const user = await sessionUser();
  let anonId = null;
  const jar = cookies();
  if (!user) {
    anonId = jar.get("julie_anon")?.value || crypto.randomBytes(12).toString("hex");
  }

  await prisma.eventView.create({
    data: { eventId, viewerId: user?.id || null, anonId },
  });

  const res = NextResponse.json({ ok: true });
  if (anonId && !jar.get("julie_anon")) {
    res.cookies.set("julie_anon", anonId, {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      path: "/",
    });
  }
  return res;
}
