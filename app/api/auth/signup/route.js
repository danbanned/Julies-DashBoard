// Viewer sign-up (12a): email + password → VIEWER account. Admin accounts
// are never created here.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase().trim();
  const password = String(body.password || "");
  const name = String(body.name || "").trim() || email.split("@")[0];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "an account with that email already exists" }, { status: 409 });
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash: bcrypt.hashSync(password, 10), role: "VIEWER" },
  });
  return NextResponse.json({ ok: true, id: user.id });
}
