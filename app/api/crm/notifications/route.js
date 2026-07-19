// CRM notification center (14e) — in-app DROPDOWN only. No push, no email,
// no ntfy, ever. Due note-reminders are lazily materialized here.
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const NO_CACHE = { "Cache-Control": "no-store, max-age=0, must-revalidate" };

export async function GET() {
  noStore();
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  // materialize reminders that came due since last look
  const due = await prisma.clientNote.findMany({
    where: { remindAt: { lte: new Date() }, reminded: false },
    include: { client: { select: { id: true, name: true } } },
  });
  for (const note of due) {
    await prisma.crmNotification.create({
      data: {
        type: "note_reminder",
        clientId: note.clientId,
        title: `Follow up: ${note.client.name}`,
        body: note.body.slice(0, 140),
      },
    });
    await prisma.clientNote.update({ where: { id: note.id }, data: { reminded: true } });
  }

  const items = await prisma.crmNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { client: { select: { id: true, name: true } } },
  });
  const unread = await prisma.crmNotification.count({ where: { read: false } });
  return NextResponse.json({ items, unread }, { headers: NO_CACHE });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.action === "markAllRead") {
    await prisma.crmNotification.updateMany({ where: { read: false }, data: { read: true } });
  } else if (b.action === "clearAll") {
    await prisma.crmNotification.deleteMany({});
  } else if (b.action === "markRead" && b.id) {
    await prisma.crmNotification.update({ where: { id: b.id }, data: { read: true } });
  } else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
