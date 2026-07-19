// Scoped CRM data reset (15e). ADMIN ONLY. Wipes ONLY the CRM tables so
// Julie can clear test/seed clients before a fresh sheet sync.
//
// SAFETY: this deletes Client, ClientNote, CrmNotification, Tag and their
// join rows — and NOTHING else. It must never touch events, posts, viewers,
// achievements, calendar, push subs, playbook, or poll data. Requires a typed
// confirmation ("RESET") so it can't fire by accident.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "RESET") {
    return NextResponse.json(
      { error: 'type "RESET" to confirm' },
      { status: 400 }
    );
  }

  // Order matters for FKs: children before parents. The implicit Client↔Tag
  // join and ClientNote/CrmNotification cascade from Client, but we clear
  // notes/notifications explicitly first to be safe, then clients, then the
  // now-orphaned tags. Nothing outside these four tables is referenced.
  const counts = {};
  counts.notifications = (await prisma.crmNotification.deleteMany({})).count;
  counts.notes = (await prisma.clientNote.deleteMany({})).count;
  counts.clients = (await prisma.client.deleteMany({})).count;
  counts.tags = (await prisma.tag.deleteMany({})).count;

  console.log("[crm/reset] wiped CRM tables:", JSON.stringify(counts));
  return NextResponse.json({ ok: true, deleted: counts });
}
