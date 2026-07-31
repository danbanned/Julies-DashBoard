// One-click unsubscribe (Phase 19, CAN-SPAM requirement). Every digest email
// links here with the subscriber's unsubscribeToken — no login, no confirm
// click required (that's the "one-click" part the law asks for).
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!token) return NextResponse.redirect(`${base}/chat?unsub=missing`);

  const sub = await prisma.subscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!sub) return NextResponse.redirect(`${base}/chat?unsub=invalid`);

  await prisma.subscriber.update({
    where: { id: sub.id },
    data: { unsubscribedAt: new Date() },
  });
  return NextResponse.redirect(`${base}/chat?unsub=ok`);
}
