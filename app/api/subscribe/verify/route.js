// Email verification landing (Phase 19). Clicking the link in the confirmation
// email hits this GET, flips emailVerified, clears the one-time token, and
// redirects to a friendly confirmation page.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!token) return NextResponse.redirect(`${base}/chat?verify=missing`);

  const sub = await prisma.subscriber.findUnique({ where: { verifyToken: token } });
  if (!sub) return NextResponse.redirect(`${base}/chat?verify=invalid`);

  await prisma.subscriber.update({
    where: { id: sub.id },
    data: { emailVerified: true, verifyToken: null },
  });
  return NextResponse.redirect(`${base}/chat?verify=ok`);
}
