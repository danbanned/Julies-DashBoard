# New-Event Notifications (Phase 5)

Julie gets a push notification on her phone whenever the morning n8n sync
commits events she hasn't seen before.

## Decision: notify FROM n8n, using ntfy

Two places could detect "a new event landed":

| Approach | How | Why / why not |
|---|---|---|
| **n8n at commit time (chosen)** | The workflow already computes `new_since_last` per event. Add two nodes after the GitHub commit: filter new events → send push. | Zero new infrastructure, one place to maintain, fires exactly once per sync. |
| Dashboard-side (Web Push / PWA) | Service worker + VAPID keys + a server that diffs the feed and pushes to subscribed browsers. | Much more moving parts, iOS Safari push requires installing the site as a PWA, permission prompts confuse non-technical users. Not worth it for one recipient. |

Delivery channel: **[ntfy.sh](https://ntfy.sh)** — free, no account required, has
iOS/Android apps, and n8n can call it with a plain HTTP Request node. (Telegram
or Pushover work the same way if ntfy is ever unavailable; Pushover is a $5
one-time app, Telegram requires creating a bot.)

## One-time setup for Julie (2 minutes)

1. Install the **ntfy** app (App Store / Play Store).
2. In the app, tap **+ Subscribe to topic** and enter the topic name below.
3. Done — notifications arrive automatically.

**Topic name:** pick something unguessable and treat it like a password
(anyone who knows the topic can send/read). Example:

```
julie-philly-events-k83qz7
```

Set it once in n8n (see below) and in Julie's app.

## n8n workflow changes

After the existing GitHub commit node(s), add:

1. **Filter node** — keep items where `new_since_last` is `true`.
2. **IF node** — if 0 items remain, stop (no notification on quiet days).
3. **Code node (digest)** — build one message so 12 new events = 1 ping, not 12:

   ```js
   const items = $input.all().map(i => i.json);
   const lines = items.slice(0, 6).map(e =>
     `• ${e.title} — ${e.start_date}${e.neighborhood && e.neighborhood !== "Unknown" ? " (" + e.neighborhood + ")" : ""}`
   );
   if (items.length > 6) lines.push(`…and ${items.length - 6} more`);
   return [{ json: {
     title: `${items.length} new event${items.length > 1 ? "s" : ""} on your dashboard`,
     body: lines.join("\n"),
     click: items.length === 1 ? (items[0].slug || items[0].event_url || "") : "https://<your-dashboard-url>"
   }}];
   ```

4. **HTTP Request node** —
   - Method: `POST`
   - URL: `https://ntfy.sh/julie-philly-events-k83qz7`  (your topic)
   - Body (raw/text): `{{ $json.body }}`
   - Headers:
     - `Title`: `{{ $json.title }}`
     - `Click`: `{{ $json.click }}`  (opens the event page / dashboard when tapped)
     - `Tags`: `tada`

## Test it

From any terminal (or an n8n manual execution):

```bash
curl -H "Title: Test — new event posted" \
     -H "Click: https://www.visitphilly.com" \
     -d "Philadelphia Cycling Classic — 2026-05-18 (Fairmount)" \
     https://ntfy.sh/julie-philly-events-k83qz7
```

If Julie's phone pings, it works.

## Notes

- The dashboard already shows a green **NEW** dot on events with
  `new_since_last: true`, so the notification and the UI agree.
- If a source file is fully rewritten each run, make sure the n8n normalize
  step keeps computing `new_since_last` by diffing against the previous
  commit's titles+dates — that flag is the single source of truth for "new".
- Nothing in this repo needs to change for notifications; it is all n8n-side.
