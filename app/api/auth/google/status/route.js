// Connection indicator (9c): GET → { connected }, POST {action:"disconnect"}
// clears the stored tokens.
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/session";
import { disconnectGoogle } from "../../../../../lib/googleCalendar";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ connected: false });
  const user = await prisma.user.findUnique({ where: { id: admin.id } });
  return NextResponse.json({ connected: Boolean(user?.googleConnected) });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.action !== "disconnect") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  await disconnectGoogle(admin.id);
  return NextResponse.json({ connected: false });
}
