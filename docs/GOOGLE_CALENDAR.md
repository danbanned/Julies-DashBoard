# Google Calendar — per-user in-app OAuth (Phase 9)

How it works (the Eventbrite model): Julie plans events with 📅 onto her
**in-app calendar** ("See Calendar" view). The first time she clicks
**Connect & add** / **Push to Google**, Google's own consent screen appears;
she approves once, and from then on events save straight to HER Google
Calendar — no popups, no token minting, no developer in the middle.

Her refresh token is stored **encrypted (AES-256-GCM)** on her user row in
the database; only the OAuth client id/secret and the encryption key live in
`.env`. The old Phase 8 approach (developer-minted `GOOGLE_OAUTH_REFRESH_TOKEN`
via the OAuth Playground) is retired.

## One-time Google Cloud setup

1. **Enable the API**: Google Cloud Console → same project as the Maps key →
   enable **Google Calendar API**.
2. **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: **External**.
   - **Keep the app in "Testing" mode** and add **Julie's Google email as a
     Test User**. In Testing mode only listed test users can authorize —
     exactly right for a single-user app, and it avoids Google's full
     app-verification review (days–weeks, privacy policy, demo video) that
     the sensitive calendar scope would otherwise trigger.
   - Do **not** click "Publish app" unless the app ever needs users beyond
     the test list.
3. **OAuth client** (APIs & Services → Credentials → Create OAuth client ID):
   - Type: **Web application**.
   - Authorized redirect URIs — add BOTH:
     - `http://localhost:3000/api/auth/google/callback` (dev)
     - `https://<your-vercel-domain>/api/auth/google/callback` (prod)
4. **Env vars** (`.env` locally, Project Settings on Vercel):

   ```
   GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=...
   TOKEN_ENCRYPTION_KEY=<64 hex chars>
   ```

   Generate the encryption key with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Restart the server after changing `.env`.

## What the app does (for the reviewer)

- `GET /api/auth/google` → redirects to Google consent
  (`calendar.events` scope, `access_type=offline`, `prompt=consent` so a
  refresh token is returned). An optional `?eventId=` rides along in `state`.
- `GET /api/auth/google/callback` → exchanges the code server-side, stores
  tokens on the user row (refresh token encrypted via `lib/tokenCrypto.js`),
  completes the pending add-to-calendar if `state` carried an eventId, then
  redirects to `/?gcal=connected|synced|error`.
- `POST /api/calendar/push` → refreshes the access token from the stored
  refresh token when expired (`googleTokenExpiry`), inserts the event into
  her primary calendar, saves `calendarEventId` (no duplicate inserts).
  Real clock times are used when the feed provides valid ones; messy times
  ("Sunset", "Matinee", empty) fall back to all-day events.
- Revoked/expired grant → `googleConnected` flips false and the UI routes her
  back through consent ("Connect") instead of erroring.
- Disconnect (calendar view) clears all stored tokens.

## Known caveat

Refresh tokens issued while the consent screen is in **Testing** mode can
expire after ~7 days in some configurations. If Julie has to reconnect weekly,
the fix is completing Google's app verification (publish the consent screen) —
not worth it unless the reconnects actually become annoying.
