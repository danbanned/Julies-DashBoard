// Admin-only: persist a replacement Daily Streak background image. Global
// (not per-user) — SiteSetting is a singleton row. See EventsSection.js's
// streakCard for the hover-revealed edit control that calls this.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const streakImageUrl = String(b.streakImageUrl || "").trim();
  if (!streakImageUrl) return NextResponse.json({ error: "streakImageUrl required" }, { status: 400 });

  const setting = await prisma.siteSetting.upsert({
    where: { id: "singleton" },
    update: { streakImageUrl },
    create: { id: "singleton", streakImageUrl },
  });
  return NextResponse.json({ ok: true, setting });
}
