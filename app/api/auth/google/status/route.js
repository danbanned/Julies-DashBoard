// Connection indicator (9c): GET → { connected }, POST {action:"disconnect"}
// clears the stored tokens.
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { CURRENT_USER_ID } from "../../../../../lib/user";
import { disconnectGoogle } from "../../../../../lib/googleCalendar";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await prisma.user.findUnique({ where: { id: CURRENT_USER_ID } });
  return NextResponse.json({ connected: Boolean(user?.googleConnected) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (body.action !== "disconnect") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  await disconnectGoogle(CURRENT_USER_ID);
  return NextResponse.json({ connected: false });
}
