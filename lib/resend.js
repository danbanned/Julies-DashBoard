// Thin Resend wrapper (Phase 19). Without RESEND_API_KEY set (e.g. local dev),
// sends are skipped and logged instead of failing — mirrors the pattern used
// for BLOB_READ_WRITE_TOKEN elsewhere in this app.
import { Resend } from "resend";

let client = null;
function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

const FROM = process.env.RESEND_FROM || "Julie Tours Philly <onboarding@resend.dev>";

// { to, subject, html } -> { ok, skipped? , error? }
export async function sendEmail({ to, subject, html }) {
  const resend = getClient();
  if (!resend) {
    console.log(`[resend] SKIPPED (no RESEND_API_KEY) — would send "${subject}" to ${to}`);
    return { ok: true, skipped: true };
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) return { ok: false, error: String(error.message || error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
