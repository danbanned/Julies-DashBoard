// Weekly neighborhood event digest (Phase 19c). Triggered by Vercel Cron
// (see vercel.json) or any scheduler that can send a GET with the shared
// secret. Pulls upcoming events, groups by neighborhood, and emails each
// VERIFIED, non-unsubscribed subscriber the events matching their chosen
// neighborhoods. Kept intentionally simple — no batching/queueing — this is
// a small list, not a mass sender.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { sendEmail } from "../../../../lib/resend";
import { loadEvents } from "../../../../lib/loadEvents";

export const dynamic = "force-dynamic";

function digestHtml(subscriberNeighborhoods, eventsByHood, unsubscribeUrl) {
  const sections = subscriberNeighborhoods
    .map((hood) => {
      const evs = eventsByHood[hood] || [];
      if (!evs.length) return "";
      const rows = evs
        .slice(0, 8)
        .map(
          (e) => `
        <li style="margin-bottom:10px">
          <strong>${e.title}</strong><br/>
          <span style="color:#666;font-size:13px">${e.start_date || ""} · ${e.neighborhood}</span>
          ${e.event_url ? `<br/><a href="${e.event_url}" style="color:#b25e3f">More info →</a>` : ""}
        </li>`
        )
        .join("");
      return `<h3 style="margin:18px 0 6px">${hood}</h3><ul style="padding-left:18px">${rows}</ul>`;
    })
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2>This week in your neighborhoods</h2>
      ${sections || "<p>No new events this week — check back soon!</p>"}
      <p style="margin-top:24px;color:#999;font-size:11px">
        <a href="${unsubscribeUrl}" style="color:#999">Unsubscribe</a> from these weekly emails.
      </p>
    </div>`;
}

export async function GET(req) {
  // Vercel Cron auto-sends "Authorization: Bearer $CRON_SECRET" when the env
  // var is named exactly CRON_SECRET; x-cron-secret supports other schedulers
  // (e.g. an n8n scheduled trigger) that can't set an Authorization header.
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || req.headers.get("x-cron-secret");
  if (secret && authHeader !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { events } = loadEvents();
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.start_date >= todayIso);

  const eventsByHood = {};
  for (const e of upcoming) (eventsByHood[e.neighborhood] ||= []).push(e);
  for (const hood in eventsByHood) eventsByHood[hood].sort((a, b) => a.start_date.localeCompare(b.start_date));

  const subscribers = await prisma.subscriber.findMany({
    where: { emailVerified: true, unsubscribedAt: null },
  });

  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const sub of subscribers) {
    const relevant = sub.neighborhoods.some((h) => (eventsByHood[h] || []).length > 0);
    if (!relevant) { skipped++; continue; }
    const unsubscribeUrl = `${base}/api/subscribe/unsubscribe?token=${sub.unsubscribeToken}`;
    const html = digestHtml(sub.neighborhoods, eventsByHood, unsubscribeUrl);
    const result = await sendEmail({ to: sub.email, subject: "This week's events in your neighborhood", html });
    if (result.ok) sent++; else failed++;
  }

  console.log(`[cron/weekly-digest] sent=${sent} skipped=${skipped} failed=${failed} totalSubscribers=${subscribers.length}`);
  return NextResponse.json({ ok: true, sent, skipped, failed, totalSubscribers: subscribers.length });
}
