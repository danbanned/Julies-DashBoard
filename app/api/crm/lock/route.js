// Phase 25 — CRM Data Lock. A secret SEPARATE from Julie's real admin login
// (auth.js's passwordHash) — compromising one never compromises the other.
// "Unlocked" is a per-session cookie (crm_unlock), not a DB field: nothing
// here says a device is unlocked forever, only that lockEnabled is on.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/session";

export const dynamic = "force-dynamic";

const COOKIE = "crm_unlock";
// No maxAge — a true session cookie, cleared when the browser session ends,
// matching the confirmed "unlock once per session" behavior.
const UNLOCK_COOKIE_OPTS = { path: "/", httpOnly: true, sameSite: "lax" };

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { id: admin.id }, select: { lockEnabled: true } });
  const jar = await cookies();
  const unlocked = Boolean(jar.get(COOKIE)?.value);
  return NextResponse.json({ lockEnabled: Boolean(user?.lockEnabled), unlocked });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const action = b.action;
  const user = await prisma.user.findUnique({ where: { id: admin.id } });

  if (action === "setup") {
    if (user.lockEnabled) return NextResponse.json({ error: "Data Lock is already enabled" }, { status: 400 });
    const password = String(b.password || "").trim();
    if (password.length < 4) return NextResponse.json({ error: "Pick a password at least 4 characters long" }, { status: 400 });
    await prisma.user.update({
      where: { id: admin.id },
      data: { lockEnabled: true, lockPasswordHash: bcrypt.hashSync(password, 10) },
    });
    const res = NextResponse.json({ ok: true, lockEnabled: true, unlocked: true });
    res.cookies.set(COOKIE, "1", UNLOCK_COOKIE_OPTS);
    return res;
  }

  if (action === "unlock") {
    if (!user.lockEnabled || !user.lockPasswordHash) {
      return NextResponse.json({ error: "Data Lock isn't enabled" }, { status: 400 });
    }
    const password = String(b.password || "");
    if (!bcrypt.compareSync(password, user.lockPasswordHash)) {
      return NextResponse.json({ error: "Wrong lock password" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, unlocked: true });
    res.cookies.set(COOKIE, "1", UNLOCK_COOKIE_OPTS);
    return res;
  }

  if (action === "relock") {
    const res = NextResponse.json({ ok: true, unlocked: false });
    res.cookies.set(COOKIE, "", { ...UNLOCK_COOKIE_OPTS, maxAge: 0 });
    return res;
  }

  if (action === "disable") {
    if (!user.lockEnabled) return NextResponse.json({ error: "Data Lock isn't enabled" }, { status: 400 });
    const password = String(b.password || "");
    if (!bcrypt.compareSync(password, user.lockPasswordHash || "")) {
      return NextResponse.json({ error: "Wrong lock password" }, { status: 401 });
    }
    await prisma.user.update({ where: { id: admin.id }, data: { lockEnabled: false, lockPasswordHash: null } });
    const res = NextResponse.json({ ok: true, lockEnabled: false, unlocked: false });
    res.cookies.set(COOKIE, "", { ...UNLOCK_COOKIE_OPTS, maxAge: 0 });
    return res;
  }

  if (action === "reset") {
    // Recovery path — required before shipping per the spec: if she forgets
    // the lock password, her REAL admin password (not the lock password)
    // re-authenticates her to set a new one.
    if (!user.lockEnabled) return NextResponse.json({ error: "Data Lock isn't enabled" }, { status: 400 });
    const adminPassword = String(b.adminPassword || "");
    const newLockPassword = String(b.newLockPassword || "").trim();
    if (!user.passwordHash || !bcrypt.compareSync(adminPassword, user.passwordHash)) {
      return NextResponse.json({ error: "Wrong admin password" }, { status: 401 });
    }
    if (newLockPassword.length < 4) return NextResponse.json({ error: "Pick a password at least 4 characters long" }, { status: 400 });
    await prisma.user.update({ where: { id: admin.id }, data: { lockPasswordHash: bcrypt.hashSync(newLockPassword, 10) } });
    const res = NextResponse.json({ ok: true, unlocked: true });
    res.cookies.set(COOKIE, "1", UNLOCK_COOKIE_OPTS);
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
