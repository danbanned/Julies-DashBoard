// ============================================================================
// normalize.js — turn messy multi-source event data into one clean list
// ----------------------------------------------------------------------------
// Pipeline per event:
//   raw source object
//     -> rename fields to canonical names (FIELD_MAP)
//     -> parse dates to YYYY-MM-DD
//     -> derive neighborhood from address zip
//     -> apply visibility rule (small events only if in-area; big always)
//     -> derive priority tier
//     -> attach image (real or fallback)
//   -> VALIDATION GATE: drop anything missing title or start_date
//   -> dedupe across sources
// ============================================================================

import {
  SOURCES,
  ZIP_TO_NEIGHBORHOOD,
  KNOWN_NEIGHBORHOODS,
  NEIGHBORHOOD_CENTROIDS,
  BIG_EVENT_ZIPS,
  HIGH_PRIORITY_NEIGHBORHOODS,
  MEDIUM_PRIORITY_NEIGHBORHOODS,
  _STATIC,
  DEFAULT_SOURCE_URL,
  FIELD_MAP,
} from "./config";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Some sources wrap events as { events: [...] }, others are a bare [...].
export function extractArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.events)) return raw.events;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

// Pull a 5-digit zip out of any address-ish string.
function zipFrom(text) {
  if (!text) return null;
  const m = String(text).match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

// Parse many date shapes into YYYY-MM-DD. Returns null if unparseable.
// Handles: "2026-07-06", "July 4, 2026", "Jul 4 2026", "7/4/2026", ISO strings.
export function toISODate(value) {
  if (!value) return null;
  const s = String(value).trim();

  // Already ISO-ish (YYYY-MM-DD...)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Let JS try ("July 4, 2026", "7/4/2026", full ISO timestamps)
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    // Guard against JS parsing garbage into year 2001 etc.
    if (y >= 2020 && y <= 2035) return `${y}-${mo}-${da}`;
  }
  return null;
}

// Source-provided neighborhood is only trusted if it maps to a canonical
// label — real n8n data sends junk here ("Unknown", "Benjamin Franklin
// Parkway", null, street-name guesses) which used to leak straight into the
// filter chips and break priority tiers.
function canonicalNeighborhood(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (!v || v === "null" || v === "unknown") return null;
  for (const name of KNOWN_NEIGHBORHOODS) {
    if (v === name.toLowerCase()) return name;
  }
  return null;
}

// Neighborhood: zip lookup wins (most reliable — "321 Fairmount Ave" is in
// Spring Garden's 19123), then a canonical source-provided value, then a name
// sniff on the address, else "Other".
function deriveNeighborhood(address, existing) {
  const zip = zipFrom(address);
  if (zip && ZIP_TO_NEIGHBORHOOD[zip]) return ZIP_TO_NEIGHBORHOOD[zip];

  const fromSource = canonicalNeighborhood(existing);
  if (fromSource) return fromSource;

  const lower = String(address || "").toLowerCase();
  if (lower.includes("brewerytown")) return "Brewerytown";
  if (lower.includes("spring garden")) return "Spring Garden";
  if (lower.includes("fairmount")) return "Fairmount";
  return "Other";
}

// Priority tier from neighborhood.
function derivePriority(neighborhood) {
  if (HIGH_PRIORITY_NEIGHBORHOODS.has(neighborhood)) return "high";
  if (MEDIUM_PRIORITY_NEIGHBORHOODS.has(neighborhood)) return "medium";
  return "low";
}

// Format a fee value for display. Handles raw numbers ("0","49"), ranges
// ("39.5-79.5"), already-"Free", and strips any stray leading $ so we never
// double it. Returns "Free" for anything zero/empty.
export function formatFee(raw) {
  if (raw == null) return "Free";
  let s = String(raw).trim();
  if (!s) return "Free";
  if (/^free$/i.test(s)) return "Free";
  // strip existing dollar signs so we control formatting
  s = s.replace(/\$/g, "").trim();
  // range like "39.5-79.5"
  const range = s.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
  if (range) {
    const lo = Number(range[1]), hi = Number(range[2]);
    if (lo === 0 && hi === 0) return "Free";
    return `$${trimNum(lo)}–$${trimNum(hi)}`;
  }
  const n = Number(s);
  if (!isNaN(n)) return n === 0 ? "Free" : `$${trimNum(n)}`;
  // non-numeric (e.g. "Donation", "Varies") — show as-is
  return s;
}
function trimNum(n) {
  // 39.5 -> "39.50"? no — keep whole numbers clean, drop trailing .0
  return Number.isInteger(n) ? String(n) : String(n);
}
// Stable string hash (djb2) — seeds the fallback-image pick per event id so
// the same event keeps the same photo across requests and re-renders.
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

// Pick a neighborhood-appropriate fallback image. `manifest` is built
// server-side in loadEvents.js: { fairmount: [urls], brewerytown: [urls],
// default: [urls] }. Missing/empty folders degrade to FALLBACK_STATIC.
export function pickFallbackImage(neighborhood, seed = "", manifest = null) {
  const n = String(neighborhood || "").toLowerCase();
  const key = n.includes("fairmount")
    ? "fairmount"
    : n.includes("brewerytown")
      ? "brewerytown"
      : "default";
  const files = (manifest && manifest[key]) || [];
  if (files.length === 0) return FALLBACK_STATIC;
  return files[hashStr(String(seed)) % files.length];
}

// Rename raw keys -> canonical using the per-source map.
function renameFields(obj, sourceId) {
  const map = FIELD_MAP[sourceId] || {};
  const out = { ...obj };
  for (const [from, to] of Object.entries(map)) {
    if (from in out) {
      out[to] = out[from];
      delete out[from];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ticketmaster has a deeply nested shape — flatten it specially.
// ---------------------------------------------------------------------------
function normalizeTicketmaster(raw) {
  // TM search response: { _embedded: { events: [...] } }
  const list =
    raw?._embedded?.events ||
    (Array.isArray(raw) ? raw : raw?.events) ||
    [];
  return list
    .filter((e) => e && e.type !== "parking") // drop parking/upsell junk
    .map((e) => {
      // n8n commits an ALREADY-FLAT shape (title/start_date/slug at top
      // level) — pass it through untouched; only the raw nested API shape
      // (name/dates/_embedded) needs flattening.
      if (e.title !== undefined && e.name === undefined) return e;
      const venue = e._embedded?.venues?.[0] || {};
      const geo = venue.location || {};
      const price = e.priceRanges?.[0];
      // pick the largest 16:9 non-fallback image
      const imgs = (e.images || []).filter((i) => !i.fallback);
      const wide = imgs
        .filter((i) => i.ratio === "16_9")
        .sort((a, b) => (b.width || 0) - (a.width || 0))[0];
      const anyImg = imgs.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
      return {
        id: e.id,
        title: e.name,
        description: e.info || e.pleaseNote || "",
        category: e.classifications?.[0]?.segment?.name || "",
        location: venue.name || "",
        address: [venue.address?.line1, venue.city?.name, venue.postalCode]
          .filter(Boolean)
          .join(", "),
        fee: price
          ? (price.max && price.max !== price.min
              ? `${price.min}-${price.max}`
              : `${price.min}`)
          : "",
        start_date: e.dates?.start?.localDate || "",
        end_date: "",
        start_time: e.dates?.start?.localTime || "",
        end_time: "",
        event_url: e.url || "",
        image_url: (wide || anyImg)?.url || "",
        lat: geo.latitude,
        lng: geo.longitude,
      };
    });
}

// ---------------------------------------------------------------------------
// Normalize ONE event object from a given source into canonical shape.
// ---------------------------------------------------------------------------
function normalizeOne(rawEvent, source, fallbackManifest) {
  const r = renameFields(rawEvent, source.id);

  const address = r.address || "";
  const neighborhood = deriveNeighborhood(address, r.neighborhood);
  const zip = zipFrom(address);
  const isBigZip = zip ? BIG_EVENT_ZIPS.has(zip) : false;

  const id =
    r.id || `${source.id}-${(r.title || "untitled").slice(0, 40)}-${r.start_date || ""}`;

  const image_url =
    r.image_url && String(r.image_url).trim()
      ? r.image_url
      : pickFallbackImage(neighborhood, id, fallbackManifest);
  const usedFallback = !(r.image_url && String(r.image_url).trim());

  // Only a real absolute URL counts as a link — some sources use `slug` for
  // non-URL strings, and a junk href would render a dead-click card. Events
  // without one fall back to their source's listing page (7d) so every card
  // from a known source is tappable; has_real_url tracks the difference.
  const rawUrl = String(r.event_url || "").trim();
  const realUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
  const event_url = realUrl || DEFAULT_SOURCE_URL[source.id] || "";
  const has_real_url = Boolean(realUrl);

  // Coordinates: real venue geo if a source provides it, else the
  // neighborhood centroid, else null (no map marker).
  let lat = Number(r.lat ?? r.latitude);
  let lng = Number(r.lng ?? r.longitude);
  const geoExact = isFinite(lat) && isFinite(lng);
  if (!geoExact) {
    const c = NEIGHBORHOOD_CENTROIDS[neighborhood];
    lat = c ? c.lat : null;
    lng = c ? c.lng : null;
  }

  return {
    id,
    title: (r.title || "").trim(),
    description: (r.description || "").trim(),
    category: (r.category || "").trim(),
    location: (r.location || "").trim(),
    address: address.trim(),
    fee: formatFee(r.fee),
    fee_frequency: r.fee_frequency || "",
    days: r.days || "",
    start_date: toISODate(r.start_date),
    end_date: toISODate(r.end_date),
    start_time: r.start_time || "",
    end_time: r.end_time || "",
    neighborhood,
    zip,
    // pipeline timestamp — drives the "Newest added" sort (10b)
    ingested_at: r.ingested_at || "",
    priority: derivePriority(neighborhood),
    lat,
    lng,
    geoExact,
    event_url,
    has_real_url,
    image_url,
    usedFallback,
    source: source.id,
    _isBigZip: isBigZip,
    _bigByDefault: source.bigByDefault,
    new_since_last: rawEvent.new_since_last === true || rawEvent.new_since_last === "TRUE",
  };
}

// ---------------------------------------------------------------------------
// VISIBILITY RULE
//   Show if:  event is in a big-event zip  OR  its source is "big by default"
//             (Ticketmaster / Visit Philly / curated feeds).
//   Hide if:  small local source (Carto rec programs) AND not in a major zip.
// ---------------------------------------------------------------------------
function isVisible(ev) {
  if (ev._isBigZip) return true;
  if (ev._bigByDefault) return true;
  // small source, non-major location -> only if we could place it in-area
  return ["Fairmount", "Brewerytown", "Spring Garden"].includes(ev.neighborhood);
}

// ---------------------------------------------------------------------------
// VALIDATION GATE — the rule we locked in. Drop junk before it's ever shown.
// ---------------------------------------------------------------------------
function isValid(ev) {
  return Boolean(ev.title && ev.title.length > 0 && ev.start_date);
}

// An event is "upcoming" while it hasn't ended: keyed off end_date when
// present, else start_date. Multi-day/recurring events with a future end
// stay upcoming even if they started in the past; everything else moves to
// the Past Events section.
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isUpcoming(ev, today) {
  return (ev.end_date || ev.start_date) >= today;
}

// ---------------------------------------------------------------------------
// Dedupe across sources: same title + same start_date = same event.
// Keeps the first seen (source order in config = priority).
// ---------------------------------------------------------------------------
function dedupe(events) {
  const seen = new Set();
  const out = [];
  for (const ev of events) {
    const key = `${ev.title.toLowerCase().replace(/\s+/g, " ").trim()}|${ev.start_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out;
}

// ---------------------------------------------------------------------------
// MAIN: take a map of { sourceId: rawFileContents } -> clean event list + stats
// ---------------------------------------------------------------------------
export function buildEvents(rawBySource, fallbackManifest = null) {
  const dropped = { invalid: 0, hidden: 0, deduped: 0 };
  const today = todayISO();
  let all = [];

  for (const source of SOURCES) {
    const raw = rawBySource[source.id];
    if (!raw) continue;

    let items;
    if (source.id === "ticketmaster") {
      items = normalizeTicketmaster(raw).map((e) =>
        normalizeOne(e, source, fallbackManifest)
      );
    } else {
      items = extractArray(raw).map((e) => normalizeOne(e, source, fallbackManifest));
    }

    for (const ev of items) {
      if (!isValid(ev)) { dropped.invalid++; continue; }
      if (!isVisible(ev)) { dropped.hidden++; continue; }
      all.push(ev);
    }
  }

  const before = all.length;
  all = dedupe(all);
  dropped.deduped = before - all.length;

  // Guarantee unique ids — recurring programs can share a source id, and
  // duplicate ids break React list keys.
  const seenIds = new Set();
  for (const ev of all) {
    let id = ev.id, n = 2;
    while (seenIds.has(id)) id = `${ev.id}-${n++}`;
    seenIds.add(id);
    ev.id = id;
  }

  // Split into upcoming (main feed, soonest first) and past (own section,
  // most recent first). Counts/chips downstream use upcoming only.
  const events = [];
  const pastEvents = [];
  for (const ev of all) (isUpcoming(ev, today) ? events : pastEvents).push(ev);
  events.sort((a, b) => a.start_date.localeCompare(b.start_date));
  pastEvents.sort((a, b) =>
    (b.end_date || b.start_date).localeCompare(a.end_date || a.start_date)
  );

  return { events, pastEvents, dropped };
}

// Convenience: unique neighborhoods present (for auto-generated filter chips).
export function neighborhoodsFrom(events) {
  const counts = {};
  for (const ev of events) {
    counts[ev.neighborhood] = (counts[ev.neighborhood] || 0) + 1;
  }
  // Fairmount & Brewerytown first, then by count desc, "Other" last.
  const priorityOrder = ["Fairmount", "Brewerytown"];
  return Object.entries(counts)
    .sort((a, b) => {
      const ai = priorityOrder.indexOf(a[0]);
      const bi = priorityOrder.indexOf(b[0]);
      if (ai !== -1 || bi !== -1) {
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }
      if (a[0] === "Other") return 1;
      if (b[0] === "Other") return -1;
      return b[1] - a[1];
    })
    .map(([name, count]) => ({ name, count }));
}
