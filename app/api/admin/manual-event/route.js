// "Add New Event" (12e). ADMIN only. published=false rows are Drafts.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  if (!b.title || !/^\d{4}-\d{2}-\d{2}$/.test(b.startDate || "")) {
    return NextResponse.json({ error: "title and startDate (YYYY-MM-DD) required" }, { status: 400 });
  }
  const row = await prisma.manualEvent.create({
    data: {
      title: String(b.title).slice(0, 200),
      location: b.location || null,
      address: b.address || null,
      startDate: b.startDate,
      endDate: b.endDate || null,
      startTime: b.startTime || null,
      description: b.description || null,
      eventUrl: b.eventUrl || null,
      imageUrl: b.imageUrl || null,
      neighborhood: b.neighborhood || null,
      published: Boolean(b.published),
    },
  });
  return NextResponse.json({ ok: true, event: row });
}

export async function PATCH(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { id, published } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const row = await prisma.manualEvent.update({
    where: { id },
    data: { published: Boolean(published) },
  });
  return NextResponse.json({ ok: true, event: row });
}
