// Viewer magic-link request (21a). Takes an email, upserts the ONE viewer
// identity (User + linked Subscriber — 21a's "one email, one identity"
// merge), stamps a one-time login token, and emails the link via Resend.
// Admin (Julie) is explicitly excluded — her account stays password-only.
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "../../../../../lib/db";
import { sendEmail } from "../../../../../lib/resend";
import { isValidEmail } from "../../../../../lib/subscribe";

export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function magicLinkHtml(url) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Your sign-in link</h2>
      <p>Tap the link below to sign in to Julie Tours Philly. It expires in 15 minutes.</p>
      <p><a href="${url}" style="display:inline-block;background:#3e5f46;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none">Sign in</a></p>
      <p style="color:#888;font-size:12px">If you didn't request this, you can ignore this email.</p>
    </div>`;
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "a valid email is required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.role === "ADMIN") {
    // never let the weaker magic-link path touch the admin account
    return NextResponse.json({ error: "That email uses password sign-in." }, { status: 400 });
  }

  const token = randomUUID();
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { loginToken: token, loginTokenExpiresAt: expires },
      })
    : await prisma.user.create({
        data: {
          email,
          name: email.split("@")[0],
          role: "VIEWER",
          loginToken: token,
          loginTokenExpiresAt: expires,
        },
      });

  // 21a: one viewer identity — link (or create) the Subscriber row for the
  // same email so browsing state and newsletter prefs are the same record.
  const existingSub = await prisma.subscriber.findUnique({ where: { email } });
  if (existingSub && existingSub.userId !== user.id) {
    await prisma.subscriber.update({ where: { id: existingSub.id }, data: { userId: user.id } });
  } else if (!existingSub) {
    await prisma.subscriber.create({ data: { email, userId: user.id, neighborhoods: [] } });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const url = `${base}/auth/magic?token=${token}`;
  const sent = await sendEmail({ to: email, subject: "Your Julie Tours Philly sign-in link", html: magicLinkHtml(url) });

  return NextResponse.json({ ok: true, sent: sent.ok && !sent.skipped });
}
