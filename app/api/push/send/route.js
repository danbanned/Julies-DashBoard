// Send a Web Push to every stored subscription (Phase 11d).
// Protected: callers (n8n after committing new events) must send the shared
// secret in the `x-push-secret` header. Expired endpoints (404/410 Gone)
// are deleted so the table self-cleans.
import { NextResponse } from "next/server";
import webpush from "web-push";
import { prisma } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const secret = process.env.PUSH_SEND_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "PUSH_SEND_SECRET is not configured" }, { status: 501 });
  }
  if (req.headers.get("x-push-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "VAPID keys are not configured — see docs/WEB_PUSH.md" }, { status: 501 });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey,
    privateKey
  );

  const body = await req.json().catch(() => ({}));
  const payload = JSON.stringify({
    title: body.title || "New events on your dashboard",
    body: body.body || "Fresh Philly events just synced.",
    url: body.url || "/",
    icon: "/icons/home.png",
    tag: body.tag || "julie-events",
  });

  // Secret-authenticated pipeline call: notify every subscribed device
  // (Julie's + any viewers who opted in).
  const subs = await prisma.pushSubscription.findMany();

  let sent = 0;
  let removed = 0;
  const errors = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          // subscription expired/revoked — clean it up
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          removed++;
        } else {
          errors.push(`${e.statusCode || e.message}`);
        }
      }
    })
  );

  return NextResponse.json({ ok: true, subscriptions: subs.length, sent, removed, errors });
}
