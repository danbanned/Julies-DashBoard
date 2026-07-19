# Google Map setup (Phase 6d)

## Fixing `RefererNotAllowedMapError` (Phase 13.5)

If the console shows `Google Maps JavaScript API error: RefererNotAllowedMapError`,
the page's URL isn't on the key's allowlist. In Google Cloud Console →
APIs & Services → Credentials → your Maps key → **Application restrictions →
Websites**, add ALL of these referrers (Google does not support port
wildcards, so each dev port needs its own line):

```
http://localhost:3000/*
http://localhost:3001/*
http://127.0.0.1:3000/*
http://127.0.0.1:3001/*
https://<your-production-domain>/*
```

Keep the key restricted (do NOT remove restrictions) — it ships to the
browser. If dev and prod diverge, use two keys: a dev key allowing localhost
and a prod key allowing only the deployed domain, each set via
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the matching environment.

Tip: the dev server normally runs on port 3000; if another process squats on
it, `autoPort` moves the app to a random port that will NOT be on the
allowlist. Free port 3000 (kill the orphaned `node` process) rather than
adding random ports.

The "What's Happening Where" panel embeds a real Google Map with a marker per
event. Without an API key it gracefully falls back to the neighborhood-bubble
panel — the page never breaks.

## Enable the map

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or
   pick) a project and enable **Maps JavaScript API**.
2. Create an API key under **APIs & Services → Credentials**.
3. Restrict it (important — this key ships to the browser):
   - Application restriction: **HTTP referrers**, add your dashboard's domain
     (and `localhost:3000/*` for development).
   - API restriction: **Maps JavaScript API** only.
4. Put it in `.env` (see `.env.example`):

   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
   ```

5. Restart `npm run dev` (env vars are read at startup). On Vercel, add the
   same variable under Project → Settings → Environment Variables.

## How markers are placed

- If a source ever provides real coordinates (`lat`/`lng` or Ticketmaster's
  nested `venue.location`), those are used as-is (`geoExact: true`).
- Otherwise the event falls back to its neighborhood's centroid
  (`NEIGHBORHOOD_CENTROIDS` in `lib/config.js`). Centroid-shared markers are
  spread in a small ring so they don't stack invisibly.
- Events in "Other" with no centroid get no marker.

The neighborhood count bubbles under the map are computed live from the same
event data and double as the no-key fallback panel.
