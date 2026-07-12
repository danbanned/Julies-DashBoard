# Web Push notifications (Phase 11)

Why: the in-page ntfy/EventSource listener only works while a dashboard tab is
open and its connection is alive. Web Push rides the browsers' own push
services through a **service worker**, so notifications fire **even with the
dashboard closed**. It's completely free (self-generated VAPID keys, no
per-message cost). Only hard requirement: HTTPS — which Vercel provides.

**Interim / belt-and-suspenders:** Julie can install the **ntfy app**
(App/Play Store) and subscribe to topic `julie-philly-events-k83qz7` for
bulletproof native push with zero code. Keep that even after Web Push works.

## Pieces

| Piece | Where |
|---|---|
| Service worker (push + notificationclick) | `public/sw.js` → served at `/sw.js` |
| SW registration + "Enable notifications" button | `components/PushSetup.js` |
| Store subscription | `POST /api/push/subscribe` → `PushSubscription` table in Neon |
| Send push to all devices | `POST /api/push/send` (secret-protected) |
| PWA manifest (iOS requirement) | `public/manifest.json`, linked in `app/layout.js` |

## Environment variables

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # ships to the browser
VAPID_PRIVATE_KEY=              # server-only — never expose
VAPID_SUBJECT=mailto:you@...    # contact per the Web Push spec
PUSH_SEND_SECRET=               # shared secret for /api/push/send
```

Generate the key pair once: `npx web-push generate-vapid-keys`.
Add all four to the **Vercel dashboard** (Project → Settings → Environment
Variables) along with `DATABASE_URL` — the code reads everything from
`process.env`, nothing is hardcoded.

## How Julie enables it (per platform)

- **Desktop Chrome / Edge / Firefox:** open the dashboard → click
  **"🔔 Enable notifications"** → Allow. Done — works in a normal tab.
- **Android (Chrome):** same as desktop. Installing via "Add to Home screen"
  improves reliability but isn't required.
- **iPhone / iPad (iOS 16.4+): the install step is NOT optional.** Safari only
  allows Web Push for sites **installed to the Home Screen**:
  1. Open the dashboard in Safari
  2. Share button → **Add to Home Screen**
  3. Open it **from the home screen icon**
  4. Tap **"🔔 Enable notifications"** → Allow
  In a regular Safari tab, iPhone users get nothing.

Multiple devices are supported — each browser/device stores its own
subscription row; expired ones (endpoint returns 404/410) are deleted
automatically on the next send.

## Triggering a send (n8n)

After the GitHub commit step, when new events exist, add an HTTP Request node:

- Method: `POST`
- URL: `https://<your-domain>/api/push/send`
- Header: `x-push-secret: <PUSH_SEND_SECRET>` and `Content-Type: application/json`
- Body:
  ```json
  {
    "title": "3 new events this week",
    "body": "Fairmount Porchfest, Movie Night, Garden Market",
    "url": "/"
  }
  ```

Manual test from a terminal:

```bash
curl -X POST https://<your-domain>/api/push/send \
  -H "x-push-secret: $PUSH_SEND_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test push","body":"It works with the tab closed"}'
```

## Test sequence

1. Load the dashboard → DevTools → Application → Service Workers → `/sw.js` activated.
2. Click Enable → permission granted → a row appears in `PushSubscription` (Neon).
3. Hit the send route with the secret → notification appears.
4. **Close the tab entirely → hit the send route again → notification STILL
   appears.** That's the pass condition EventSource could never meet.
5. Wire the n8n node → real sync → push on new events.

## Honest expectations

- Delivery depends on the browser/OS push service being reachable and
  notifications not being muted by OS Focus/Do-Not-Disturb.
- The in-page ntfy listener (`EventAlerts.js`) is demoted: it still refreshes
  an OPEN dashboard (NEW dots, bell, toast) but no longer fires OS
  notifications — Web Push owns those now, so nothing double-fires.

## Vercel deployment notes (Phase 11 audit)

- **API routes**: `app/api/push/send/route.js` and
  `app/api/push/subscribe/route.js` are App Router route handlers — Vercel
  maps them to serverless functions automatically. `vercel.json` deliberately
  contains **no `routes`/`rewrites`** (legacy `routes` would override Next's
  routing and break things); it only sets headers: `no-cache` on `/sw.js` so
  worker updates roll out immediately.
- **Prisma on Vercel**: the generated client lives in `lib/generated/` which
  is gitignored — `package.json` has `"postinstall": "prisma generate"` so
  Vercel regenerates it on every install. The runtime client reads
  `process.env.DATABASE_URL` (pooled Neon URL) dynamically.
- **Migrations** run locally (`npx prisma migrate dev` uses `DIRECT_URL`);
  Vercel never migrates.
