// Phase 23 — public "Work with Julie" lead capture. Public, unauthenticated —
// separate from /api/subscribe (newsletter Subscriber model). Creates a real
// CRM Client row so a new lead surfaces in Julie's existing Today's Top
// Clients queue via lib/crm.js's actionability() — no separate alert channel,
// matches the in-app-dropdown-only rule from Phase 14.
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { isValidEmail } from "../../../lib/subscribe";

export const dynamic = "force-dynamic";

const INTENT_TO_CLIENT_TYPE = { RENT: "RENTER", BUY: "BUYER", UNSURE: "RENTER" };
const INTENT_LABEL = { RENT: "Renting", BUY: "Buying", UNSURE: "Not sure yet" };

export async function POST(req) {
  const b = await req.json().catch(() => ({}));

  const name = String(b.name || "").replace(/\s+/g, " ").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const email = String(b.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) return NextResponse.json({ error: "a valid email is required" }, { status: 400 });

  const intent = INTENT_TO_CLIENT_TYPE[b.intent] ? b.intent : "UNSURE";
  const clientType = INTENT_TO_CLIENT_TYPE[intent];
  const message = String(b.message || "").trim();

  const notes = [intent === "UNSURE" ? "Not sure yet — rent or buy" : null, message || null]
    .filter(Boolean)
    .join(" — ") || null;

  const client = await prisma.client.create({
    data: { name, email, clientType, source: "FORM", stage: "NEW", notes },
  });

  await prisma.crmNotification.create({
    data: {
      type: "new_lead",
      clientId: client.id,
      title: `New lead: ${client.name}`,
      body: `${INTENT_LABEL[intent]} · via Work with Julie`,
    },
  });

  return NextResponse.json({ ok: true });
}
