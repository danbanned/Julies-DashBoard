# Google Map setup (Phase 6d)

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
