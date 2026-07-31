// Newsletter subscribe API (Phase 19). Public — anyone can subscribe, but a
// logged-in viewer's own session email is used automatically (no separate
// email box) and their existing Subscriber row is updated, never duplicated.
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "../../../lib/db";
import { sessionUser } from "../../../lib/session";
import { sendEmail } from "../../../lib/resend";
import { normalizeNeighborhoods, isValidEmail } from "../../../lib/subscribe";

export const dynamic = "force-dynamic";

function verifyEmailHtml(verifyUrl) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Confirm your email</h2>
      <p>Tap the link below to start receiving weekly neighborhood event emails from Julie Tours Philly.</p>
      <p><a href="${verifyUrl}" style="display:inline-block;background:#b25e3f;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none">Confirm my email</a></p>
      <p style="color:#888;font-size:12px">If you didn't request this, you can ignore this email.</p>
    </div>`;
}

// GET — current subscriber status for the logged-in viewer (preference-only
// flow reads this to pre-fill their existing neighborhoods without re-asking
// for an email).
export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ subscriber: null });
  const sub = await prisma.subscriber.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ subscriber: sub, viewerEmail: user.email || null });
}

// POST — create or update a subscriber. Body: { email?, neighborhoods: [] }
// email is ignored (session email used instead) when logged in.
export async function POST(req) {
  const user = await sessionUser();
  const b = await req.json().catch(() => ({}));
  const neighborhoods = normalizeNeighborhoods(b.neighborhoods);
  if (!neighborhoods.length) {
    return NextResponse.json({ error: "pick at least one neighborhood" }, { status: 400 });
  }

  // logged-in viewer: preference-only, keyed by userId, reuse their session email
  if (user) {
    const email = String(user.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "your account has no email on file" }, { status: 400 });

    const existing = await prisma.subscriber.findUnique({ where: { userId: user.id } });
    if (existing) {
      const sub = await prisma.subscriber.update({ where: { id: existing.id }, data: { neighborhoods } });
      return NextResponse.json({ ok: true, subscriber: sub, verifyEmailSent: false });
    }
    const verifyToken = randomUUID();
    const sub = await prisma.subscriber.create({
      data: { email, userId: user.id, neighborhoods, verifyToken },
    });
    const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/subscribe/verify?token=${verifyToken}`;
    const sent = await sendEmail({ to: email, subject: "Confirm your Julie Tours Philly newsletter", html: verifyEmailHtml(verifyUrl) });
    return NextResponse.json({ ok: true, subscriber: sub, verifyEmailSent: sent.ok && !sent.skipped });
  }

  // anonymous signup: email required, validated
  const email = String(b.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) return NextResponse.json({ error: "a valid email is required" }, { status: 400 });

  const existing = await prisma.subscriber.findUnique({ where: { email } });
  if (existing) {
    const sub = await prisma.subscriber.update({ where: { id: existing.id }, data: { neighborhoods } });
    return NextResponse.json({ ok: true, subscriber: sub, alreadySubscribed: true, verified: existing.emailVerified });
  }

  const verifyToken = randomUUID();
  const sub = await prisma.subscriber.create({ data: { email, neighborhoods, verifyToken } });
  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/subscribe/verify?token=${verifyToken}`;
  const sent = await sendEmail({ to: email, subject: "Confirm your Julie Tours Philly newsletter", html: verifyEmailHtml(verifyUrl) });
  return NextResponse.json({ ok: true, subscriber: sub, verifyEmailSent: sent.ok && !sent.skipped });
}
