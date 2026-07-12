// Start the in-app Google OAuth flow (9a). Optional ?eventId= is carried in
// `state` so the callback can finish the add-to-calendar Julie clicked.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_OAUTH_CLIENT_ID is not set — see docs/GOOGLE_CALENDAR.md" },
      { status: 501 }
    );
  }
  const origin = req.nextUrl.origin;
  const eventId = req.nextUrl.searchParams.get("eventId") || "";

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events");
  url.searchParams.set("access_type", "offline"); // get a refresh token
  url.searchParams.set("prompt", "consent"); // ensure refresh token is returned
  if (eventId) url.searchParams.set("state", eventId);

  return NextResponse.redirect(url);
}
