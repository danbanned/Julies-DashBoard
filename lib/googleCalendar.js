// Google Calendar with per-user OAuth tokens (Phase 9d).
// Access tokens auto-refresh from the (encrypted) refresh token; a revoked
// grant flips the user back to disconnected instead of crashing.
import { prisma } from "./db";
import { encryptToken, decryptToken } from "./tokenCrypto";

export class ReconnectNeeded extends Error {
  constructor() {
    super("Google Calendar needs to be reconnected");
    this.code = "RECONNECT";
  }
}

export async function disconnectGoogle(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleConnected: false,
      googleRefreshToken: null,
      googleAccessToken: null,
      googleTokenExpiry: null,
    },
  });
}

// Exchange the OAuth authorization code for tokens and store them (9a/9b).
export async function storeTokensFromCode(userId, code, redirectUri) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`code exchange failed: ${res.status} ${await res.text()}`);
  const t = await res.json();
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleConnected: true,
      // Google only returns refresh_token on the consent prompt — keep the
      // existing one if a re-auth omits it.
      ...(t.refresh_token ? { googleRefreshToken: encryptToken(t.refresh_token) } : {}),
      googleAccessToken: t.access_token,
      googleTokenExpiry: new Date(Date.now() + (t.expires_in || 3600) * 1000),
    },
  });
}

async function freshAccessToken(user) {
  const valid =
    user.googleAccessToken &&
    user.googleTokenExpiry &&
    user.googleTokenExpiry.getTime() > Date.now() + 60_000;
  if (valid) return user.googleAccessToken;

  if (!user.googleRefreshToken) throw new ReconnectNeeded();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: decryptToken(user.googleRefreshToken),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    // invalid_grant = revoked/expired refresh token → back to "connect"
    await disconnectGoogle(user.id);
    throw new ReconnectNeeded();
  }
  const t = await res.json();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      googleAccessToken: t.access_token,
      googleTokenExpiry: new Date(Date.now() + (t.expires_in || 3600) * 1000),
    },
  });
  return t.access_token;
}

// "18:00:00" / "18:00" → usable clock time; "Sunset", "Matinee", "" → null.
function clockTime(t) {
  const m = String(t || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}:00`;
}

function nextDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Insert an interaction's event into the user's primary calendar; returns the
// Google event id. Real clock times when the feed has them, all-day otherwise.
export async function insertCalendarEvent(user, row, startTime, endTime) {
  const token = await freshAccessToken(user);
  const start = row.eventStartDate;
  const end = row.eventEndDate || row.eventStartDate;

  const st = clockTime(startTime);
  let when;
  if (st && start === end) {
    const et = clockTime(endTime);
    const endClock = et && et > st ? et : `${String(Math.min(23, Number(st.slice(0, 2)) + 2)).padStart(2, "0")}${st.slice(2)}`;
    const TZ = "America/New_York";
    when = {
      start: { dateTime: `${start}T${st}`, timeZone: TZ },
      end: { dateTime: `${end}T${endClock}`, timeZone: TZ },
    };
  } else {
    when = { start: { date: start }, end: { date: nextDay(end) } };
  }

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: row.eventTitle,
      location: row.location || "",
      description: [row.eventUrl, `Added from Julie's Dashboard (${row.source || "feed"})`]
        .filter(Boolean)
        .join("\n"),
      ...when,
    }),
  });
  if (res.status === 401) {
    await disconnectGoogle(user.id);
    throw new ReconnectNeeded();
  }
  if (!res.ok) throw new Error(`Google Calendar API ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}
