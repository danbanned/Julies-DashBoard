// Julie's curation controls (12e/12f): suggest / hide / attach content idea.
// ADMIN only — this is the lane viewers never touch.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { eventId } = body;
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const patch = {};
  if (typeof body.suggested === "boolean") patch.suggested = body.suggested;
  if (typeof body.hidden === "boolean") patch.hidden = body.hidden;
  if ("contentIdeaKey" in body) patch.contentIdeaKey = body.contentIdeaKey || null;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const meta = await prisma.eventMeta.upsert({
    where: { eventId },
    update: patch,
    create: { eventId, ...patch },
  });
  return NextResponse.json({ ok: true, meta });
}
