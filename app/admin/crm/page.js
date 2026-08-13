// Julie's CRM (Phase 14) — ADMIN ONLY, server-enforced. Real client PII
// lives behind this gate and its APIs; nothing reaches the viewer surface.
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import CrmApp from "../../../components/CrmApp";
import { requireAdmin } from "../../../lib/session";
import { prisma } from "../../../lib/db";
import { LAYOUT_OPTIONS } from "../../../lib/config";

// never statically cached: CRM data is live PII, re-queried each request
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "JulieTours — CRM" };

export default async function CrmPage() {
  noStore();
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  // Phase 24 — Layout (data-jw-layout) is per-surface, not the cookie-only
  // path Theme/Season use in app/layout.js: Julie's own saved layoutPref
  // wins so her Desk choice persists across devices.
  const layoutValues = LAYOUT_OPTIONS.map((o) => o.value);
  const dbUser = await prisma.user.findUnique({ where: { id: admin.id }, select: { layoutPref: true } });
  const jar = await cookies();
  const cookieLayout = jar.get("jw_layout")?.value;
  const layoutPref = layoutValues.includes(dbUser?.layoutPref)
    ? dbUser.layoutPref
    : layoutValues.includes(cookieLayout)
      ? cookieLayout
      : "column";

  return (
    <>
      <div className="pageBackdrop" />
      <CrmApp layoutPref={layoutPref} />
    </>
  );
}
