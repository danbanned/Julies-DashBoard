// Playbook PDF export (15g) — a clean, print-optimized document (not a UI
// screenshot). Opens with the browser print dialog; "Save as PDF" yields a
// formatted handout of pillars → sections → blocks → callouts. Admin only.
import { redirect } from "next/navigation";
import { requireAdmin } from "../../../../lib/session";
import { prisma } from "../../../../lib/db";
import ExportPrint from "../../../../components/PlaybookExport";

export const dynamic = "force-dynamic";
export const metadata = { title: "Content Playbook — Export" };

export default async function PlaybookExportPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const pillars = await prisma.playbookPillar.findMany({
    orderBy: { order: "asc" },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { blocks: { orderBy: { order: "asc" }, include: { callouts: { orderBy: { order: "asc" } } } } },
      },
    },
  });
  let total = 0;
  for (const p of pillars) for (const s of p.sections) for (const b of s.blocks) total += b.callouts.length;

  return <ExportPrint pillars={pillars} total={total} />;
}
