// Content Playbook (15f) — ADMIN ONLY, server-enforced.
import { redirect } from "next/navigation";
import PlaybookApp from "../../../components/PlaybookApp";
import { requireAdmin } from "../../../lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Julie's Content Playbook" };

export default async function PlaybookPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  return (
    <>
      <div className="pageBackdrop" />
      <PlaybookApp />
    </>
  );
}
