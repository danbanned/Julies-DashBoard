// Phase 24 — Settings: Account fields + Theme/Layout/Seasonal prefs. Cookies
// are the source of truth for SSR rendering (app/layout.js reads them) and
// work for anonymous visitors; signed-in users additionally get their prefs
// persisted on User for cross-device durability. Password editing is
// ADMIN-only — viewers authenticate via magic link and have no passwordHash
// to change (see prisma/schema.prisma's Auth comment).
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/db";
import { sessionUser } from "../../../lib/session";
import { THEME_OPTIONS, LAYOUT_OPTIONS, SEASON_OPTIONS } from "../../../lib/config";

export const dynamic = "force-dynamic";

const THEME_VALUES = THEME_OPTIONS.map((o) => o.value);
const LAYOUT_VALUES = LAYOUT_OPTIONS.map((o) => o.value);
const SEASON_VALUES = SEASON_OPTIONS.map((o) => o.value);

const COOKIE_OPTS = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" };

export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ user: null });
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, phone: true, role: true, themePref: true, layoutPref: true, seasonPref: true },
  });
  return NextResponse.json({ user: full });
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const user = await sessionUser();

  const theme = THEME_VALUES.includes(b.themePref) ? b.themePref : "original";
  const layout = LAYOUT_VALUES.includes(b.layoutPref) ? b.layoutPref : "column";
  const season = SEASON_VALUES.includes(b.seasonPref) ? b.seasonPref : "off";

  const data = {
    themePref: theme,
    layoutPref: layout,
    seasonPref: season,
  };
  if (typeof b.phone === "string") data.phone = b.phone.trim() || null;
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();

  if (user?.role === "ADMIN" && typeof b.password === "string" && b.password.trim()) {
    data.passwordHash = bcrypt.hashSync(b.password.trim(), 10);
  }

  let updated = null;
  if (user) {
    updated = await prisma.user.update({ where: { id: user.id }, data });
  }

  const res = NextResponse.json({ ok: true, user: updated });
  res.cookies.set("jw_theme", theme, COOKIE_OPTS);
  res.cookies.set("jw_layout", layout, COOKIE_OPTS);
  res.cookies.set("jw_season", season, COOKIE_OPTS);
  return res;
}
