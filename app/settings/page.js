// Phase 24 — Settings page. One shared, role-aware page for both Julie
// (ADMIN) and viewers, following the app/work-with-julie/page.js pattern:
// server component fetches session + current prefs, client component renders
// the form.
import { cookies } from "next/headers";
import { sessionUser } from "../../lib/session";
import { prisma } from "../../lib/db";
import SettingsPage from "../../components/SettingsPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings — Julie Tours Philly" };

export default async function SettingsRoute() {
  const user = await sessionUser();
  const jar = await cookies();

  let account = null;
  if (user) {
    account = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, phone: true, role: true, themePref: true, layoutPref: true, seasonPref: true },
    });
  }

  const initialPrefs = {
    themePref: account?.themePref || jar.get("jw_theme")?.value || "original",
    layoutPref: account?.layoutPref || jar.get("jw_layout")?.value || "column",
    seasonPref: account?.seasonPref || jar.get("jw_season")?.value || "off",
  };

  return <SettingsPage account={account} initialPrefs={initialPrefs} />;
}
