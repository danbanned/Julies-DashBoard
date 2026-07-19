// Julie's CRM (Phase 14) — ADMIN ONLY, server-enforced. Real client PII
// lives behind this gate and its APIs; nothing reaches the viewer surface.
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import CrmApp from "../../../components/CrmApp";
import { requireAdmin } from "../../../lib/session";

// never statically cached: CRM data is live PII, re-queried each request
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "JulieTours — CRM" };

export default async function CrmPage() {
  noStore();
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  return (
    <>
      <div className="pageBackdrop" />
      <CrmApp />
    </>
  );
}
