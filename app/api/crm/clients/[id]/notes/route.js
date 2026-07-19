// Client notes (14d) — a note with remindAt becomes a follow-up reminder.
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/session";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const body = String(b.body || "").trim();
  if (!body) return NextResponse.json({ error: "note body required" }, { status: 400 });

  const note = await prisma.clientNote.create({
    data: {
      clientId: params.id,
      body,
      remindAt: b.remindAt ? new Date(b.remindAt) : null,
    },
  });
  // a reminder also surfaces the client in Today's queue via followUpDue
  if (b.remindAt) {
    await prisma.client.update({
      where: { id: params.id },
      data: { followUpDue: new Date(b.remindAt) },
    });
  }
  return NextResponse.json({ ok: true, note });
}
