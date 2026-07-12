// Store/remove a Web Push subscription (Phase 11c). One user can have
// several rows (phone + laptop) — endpoint is the unique key.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { CURRENT_USER_ID } from "../../../../lib/user";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const sub = await req.json().catch(() => null);
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "expected a PushSubscription JSON ({endpoint, keys:{p256dh, auth}})" },
      { status: 400 }
    );
  }
  const row = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh, auth, userId: CURRENT_USER_ID },
    create: { userId: CURRENT_USER_ID, endpoint, p256dh, auth },
  });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req) {
  const { endpoint } = await req.json().catch(() => ({}));
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}
