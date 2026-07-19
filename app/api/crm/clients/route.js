// Client list + manual Add Client (14b/14c). ADMIN ONLY — real PII.
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/session";
import { actionability, stagesFor } from "../../../../lib/crm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// no-store response headers so the browser/CDN never caches this PII read
const NO_CACHE = { "Cache-Control": "no-store, max-age=0, must-revalidate" };

export async function GET() {
  noStore();
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const clients = await prisma.client.findMany({
    include: { tags: true },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  const withAction = clients.map((c) => ({ ...c, action: actionability(c, now) }));
  return NextResponse.json({ clients: withAction }, { headers: NO_CACHE });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").replace(/\s+/g, " ").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const clientType = b.clientType === "BUYER" ? "BUYER" : "RENTER";
  const source = ["MANUAL", "CALL", "TEXT", "REFERRAL"].includes(b.source) ? b.source : "MANUAL";

  const client = await prisma.client.create({
    data: {
      name,
      email: b.email?.trim() || null,
      emailIsReal: Boolean(b.email?.trim() && b.emailIsReal),
      phone: b.phone?.trim() || null,
      partners: b.partners?.trim() || null,
      clientType,
      source,
      neighborhoods: Array.isArray(b.neighborhoods)
        ? b.neighborhoods
        : String(b.neighborhoods || "").split(",").map((s) => s.trim()).filter(Boolean),
      moveMonth: b.moveMonth ? new Date(b.moveMonth) : null,
      creditBand: ["UNDER_650", "B650_699", "B700_749", "B750_PLUS"].includes(b.creditBand)
        ? b.creditBand
        : "UNKNOWN",
      proofOfIncome: typeof b.proofOfIncome === "boolean" ? b.proofOfIncome : null,
      whoLiving: b.whoLiving?.trim() || null,
      outOfState: Boolean(b.outOfState),
      notes: b.notes?.trim() || null,
      specificProperty: b.specificProperty?.trim() || null,
      maxRent: b.maxRent ? Math.round(Number(b.maxRent)) || null : null,
      bedroomsMin: b.bedroomsMin ? parseInt(b.bedroomsMin, 10) || null : null,
      bedroomsRaw: b.bedroomsRaw?.trim() || null,
      pets: Boolean(b.pets),
      budget: b.budget ? Math.round(Number(b.budget)) || null : null,
      financing: b.financing?.trim() || null,
      stage: stagesFor(clientType)[0],
    },
  });
  return NextResponse.json({ ok: true, client });
}
