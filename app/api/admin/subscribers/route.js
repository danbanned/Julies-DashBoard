// Admin-only newsletter subscriber stats (Phase 19d). Lightweight — total +
// per-neighborhood counts, not a full CRM-style management page.
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/session";
import { NEIGHBORHOOD_OPTIONS } from "../../../../lib/subscribe";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  noStore();
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const subs = await prisma.subscriber.findMany({ where: { unsubscribedAt: null } });
  const verified = subs.filter((s) => s.emailVerified);

  const byNeighborhood = {};
  for (const h of NEIGHBORHOOD_OPTIONS) {
    byNeighborhood[h] = verified.filter((s) => s.neighborhoods.includes(h)).length;
  }

  return NextResponse.json(
    {
      total: subs.length,
      verified: verified.length,
      pending: subs.length - verified.length,
      byNeighborhood,
    },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
  );
}
