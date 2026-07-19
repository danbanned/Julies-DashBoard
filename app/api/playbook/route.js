// Content Playbook API (15f). ADMIN ONLY. GET returns the full tree with real
// counts; POST is a consolidated CRUD dispatcher for sections/blocks/callouts
// so Julie's playbook is a living, editable tool.
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { requireAdmin } from "../../../lib/session";

export const dynamic = "force-dynamic";

const CALLOUT_TYPES = ["CONTENT_IDEA", "REEL_IDEA", "SHOOT_HERE", "WHY_IT_WORKS", "DONT_DO_THIS", "PRO_TIP", "NOTE"];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const pillars = await prisma.playbookPillar.findMany({
    orderBy: { order: "asc" },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          blocks: {
            orderBy: { order: "asc" },
            include: { callouts: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  // real idea counts = callouts under each pillar (never hardcoded)
  const counts = {};
  let total = 0;
  for (const p of pillars) {
    let n = 0;
    for (const s of p.sections) for (const b of s.blocks) n += b.callouts.length;
    counts[p.key] = n;
    total += n;
  }
  return NextResponse.json({ pillars, counts, total });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const { action } = b;

  try {
    switch (action) {
      // ---- SECTION ----
      case "createSection": {
        if (!b.pillarId || !b.title?.trim()) return NextResponse.json({ error: "pillarId and title required" }, { status: 400 });
        const max = await prisma.playbookSection.aggregate({ where: { pillarId: b.pillarId }, _max: { order: true } });
        const section = await prisma.playbookSection.create({
          data: {
            pillarId: b.pillarId,
            title: b.title.trim().slice(0, 200),
            subtitle: b.subtitle?.trim() || null,
            neighborhoods: Array.isArray(b.neighborhoods) ? b.neighborhoods : ["Fairmount", "Brewerytown"],
            order: (max._max.order ?? -1) + 1,
            // a new section starts with one block so ideas can be added
            blocks: { create: { heading: b.title.trim().slice(0, 200), order: 0 } },
          },
          include: { blocks: true },
        });
        return NextResponse.json({ ok: true, section });
      }
      case "updateSection": {
        const data = {};
        if ("title" in b) data.title = String(b.title).trim().slice(0, 200);
        if ("subtitle" in b) data.subtitle = b.subtitle?.trim() || null;
        if ("neighborhoods" in b && Array.isArray(b.neighborhoods)) data.neighborhoods = b.neighborhoods;
        const section = await prisma.playbookSection.update({ where: { id: b.id }, data });
        return NextResponse.json({ ok: true, section });
      }
      case "deleteSection": {
        await prisma.playbookSection.delete({ where: { id: b.id } });
        return NextResponse.json({ ok: true });
      }
      // ---- BLOCK ----
      case "createBlock": {
        if (!b.sectionId || !b.heading?.trim()) return NextResponse.json({ error: "sectionId and heading required" }, { status: 400 });
        const max = await prisma.playbookBlock.aggregate({ where: { sectionId: b.sectionId }, _max: { order: true } });
        const block = await prisma.playbookBlock.create({
          data: { sectionId: b.sectionId, emoji: b.emoji || null, heading: b.heading.trim().slice(0, 200), body: b.body?.trim() || null, order: (max._max.order ?? -1) + 1 },
        });
        return NextResponse.json({ ok: true, block });
      }
      case "updateBlock": {
        const data = {};
        if ("heading" in b) data.heading = String(b.heading).trim().slice(0, 200);
        if ("emoji" in b) data.emoji = b.emoji || null;
        if ("body" in b) data.body = b.body?.trim() || null;
        const block = await prisma.playbookBlock.update({ where: { id: b.id }, data });
        return NextResponse.json({ ok: true, block });
      }
      case "deleteBlock": {
        await prisma.playbookBlock.delete({ where: { id: b.id } });
        return NextResponse.json({ ok: true });
      }
      // ---- CALLOUT (a content "idea") ----
      case "createCallout": {
        if (!b.blockId || !b.text?.trim()) return NextResponse.json({ error: "blockId and text required" }, { status: 400 });
        const type = CALLOUT_TYPES.includes(b.type) ? b.type : "CONTENT_IDEA";
        const max = await prisma.playbookCallout.aggregate({ where: { blockId: b.blockId }, _max: { order: true } });
        const callout = await prisma.playbookCallout.create({
          data: { blockId: b.blockId, type, text: b.text.trim().slice(0, 2000), order: (max._max.order ?? -1) + 1 },
        });
        return NextResponse.json({ ok: true, callout });
      }
      case "updateCallout": {
        const data = {};
        if ("text" in b) data.text = String(b.text).trim().slice(0, 2000);
        if ("type" in b && CALLOUT_TYPES.includes(b.type)) data.type = b.type;
        const callout = await prisma.playbookCallout.update({ where: { id: b.id }, data });
        return NextResponse.json({ ok: true, callout });
      }
      case "deleteCallout": {
        await prisma.playbookCallout.delete({ where: { id: b.id } });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
