// Client detail + workflow updates (14d). ADMIN ONLY.
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/session";
import { stagesFor, STAGE_LABELS } from "../../../../../lib/crm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const NO_CACHE = { "Cache-Control": "no-store, max-age=0, must-revalidate" };

export async function GET(req, { params }) {
  noStore();
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { tags: true, clientNotes: { orderBy: { createdAt: "desc" } } },
  });
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ client }, { headers: NO_CACHE });
}

export async function PATCH(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = {};
  if (typeof b.pinned === "boolean") data.pinned = b.pinned;
  if (b.markContacted) {
    data.lastReachedOut = new Date();
    data.snoozedUntil = null;
  }
  if (b.snoozeDays) {
    const until = new Date();
    until.setDate(until.getDate() + Math.min(30, Math.max(1, parseInt(b.snoozeDays, 10) || 3)));
    data.snoozedUntil = until;
  }
  if ("followUpDue" in b) data.followUpDue = b.followUpDue ? new Date(b.followUpDue) : null;
  if ("email" in b) {
    data.email = b.email?.trim() || null;
    data.emailIsReal = Boolean(b.email?.trim() && b.emailIsReal);
  }
  if ("phone" in b) data.phone = b.phone?.trim() || null;
  if ("notes" in b) data.notes = b.notes?.trim() || null;

  // 18a: full edit-in-place — every standard profile field is patchable.
  const trimOrNull = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const intOrNull = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  };
  if ("name" in b) {
    if (!String(b.name || "").trim()) return NextResponse.json({ error: "name can't be empty" }, { status: 400 });
    data.name = String(b.name).trim().slice(0, 200);
  }
  if ("partners" in b) data.partners = trimOrNull(b.partners);
  if ("whoLiving" in b) data.whoLiving = trimOrNull(b.whoLiving);
  if ("specificProperty" in b) data.specificProperty = trimOrNull(b.specificProperty);
  if ("financing" in b) data.financing = trimOrNull(b.financing);
  if ("bedroomsRaw" in b) data.bedroomsRaw = trimOrNull(b.bedroomsRaw);
  if ("neighborhoods" in b && Array.isArray(b.neighborhoods)) {
    data.neighborhoods = b.neighborhoods.map((s) => String(s).trim()).filter(Boolean);
  }
  if ("moveMonth" in b) data.moveMonth = b.moveMonth ? new Date(b.moveMonth) : null;
  if ("maxRent" in b) data.maxRent = intOrNull(b.maxRent);
  if ("bedroomsMin" in b) data.bedroomsMin = intOrNull(b.bedroomsMin);
  if ("budget" in b) data.budget = intOrNull(b.budget);
  if (typeof b.pets === "boolean") data.pets = b.pets;
  if (typeof b.outOfState === "boolean") data.outOfState = b.outOfState;
  if (typeof b.takingOn === "boolean") data.takingOn = b.takingOn;
  if ("proofOfIncome" in b) data.proofOfIncome = b.proofOfIncome === null ? null : Boolean(b.proofOfIncome);
  if ("creditBand" in b) {
    const BANDS = ["UNDER_650", "B650_699", "B700_749", "B750_PLUS", "UNKNOWN"];
    if (BANDS.includes(b.creditBand)) data.creditBand = b.creditBand;
  }
  if ("clientType" in b && ["RENTER", "BUYER"].includes(b.clientType)) data.clientType = b.clientType;

  if (b.stage) {
    const stages = stagesFor(client.clientType);
    if (!stages.includes(b.stage)) {
      return NextResponse.json({ error: `invalid stage for ${client.clientType}` }, { status: 400 });
    }
    data.stage = b.stage;
  }
  if ("tags" in b && Array.isArray(b.tags)) {
    // descriptive labels only — connect-or-create by name (never used for ranking)
    data.tags = {
      set: [],
      connectOrCreate: b.tags
        .map((t) => String(t).trim())
        .filter(Boolean)
        .map((name) => ({ where: { name }, create: { name } })),
    };
  }

  const updated = await prisma.client.update({
    where: { id: params.id },
    data,
    include: { tags: true, clientNotes: { orderBy: { createdAt: "desc" } } },
  });

  // stage changes are high-value → notification center item (in-app only)
  if (b.stage && b.stage !== client.stage) {
    await prisma.crmNotification.create({
      data: {
        type: "stage_change",
        clientId: client.id,
        title: `${client.name} → ${STAGE_LABELS[b.stage] || b.stage}`,
        body: `Pipeline moved from ${STAGE_LABELS[client.stage] || client.stage}.`,
      },
    });
  }
  return NextResponse.json({ ok: true, client: updated });
}
