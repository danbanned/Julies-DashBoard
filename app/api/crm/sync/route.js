// Sheets → n8n → HERE (14b). Accepts an array of (raw or pre-cleaned) form
// rows, cleans them, upserts by stable formKey. Auth: Julie's admin session
// OR the x-crm-secret header for n8n. CRM data is PII — nothing here is ever
// public, pushed, or emailed.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/session";
import { cleanFormRow } from "../../../../lib/crm";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const secret = process.env.CRM_SYNC_SECRET;
  const bySecret = secret && req.headers.get("x-crm-secret") === secret;
  const admin = bySecret ? true : await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "rows[] required" }, { status: 400 });

  let created = 0;
  let updated = 0;
  let dropped = 0;
  for (const row of rows) {
    const clean = cleanFormRow(row);
    if (!clean) {
      dropped++; // validation gate: no name
      continue;
    }
    const { intakeNote, ...data } = clean;
    const existing = await prisma.client.findUnique({ where: { formKey: data.formKey } });
    if (existing) {
      // re-syncs refresh sheet-owned fields but never clobber Julie's
      // workflow state (stage, pins, follow-ups, lastReachedOut) or the
      // original createdAt timestamp
      const { stage, lastReachedOut, createdAt, ...refresh } = data;
      await prisma.client.update({ where: { id: existing.id }, data: refresh });
      updated++;
    } else {
      const client = await prisma.client.create({ data });
      created++;
      if (intakeNote) {
        await prisma.clientNote.create({
          data: { clientId: client.id, body: `From the form: ${intakeNote}` },
        });
      }
      await prisma.crmNotification.create({
        data: {
          type: "new_lead",
          clientId: client.id,
          title: `New lead: ${client.name}`,
          body: [client.neighborhoods.join(", "), client.maxRent ? `up to $${client.maxRent}/mo` : null]
            .filter(Boolean)
            .join(" · "),
        },
      });
    }
  }
  console.log(`[crm/sync] created=${created} updated=${updated} dropped=${dropped}`);
  return NextResponse.json({ ok: true, created, updated, dropped });
}
