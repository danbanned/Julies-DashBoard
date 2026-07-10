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
  BIG_EVENT_ZIPS,
  HIGH_PRIORITY_NEIGHBORHOODS,
  MEDIUM_PRIORITY_NEIGHBORHOODS,
  FALLBACK_IMAGES,
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

// Neighborhood from an address string (zip lookup first, then name sniff).
function deriveNeighborhood(address, existing) {
  // If the source already gave a real neighborhood, keep it.
  if (existing && String(existing).trim() && String(existing).toLowerCase() !== "null") {
    return String(existing).trim();
  }
  const zip = zipFrom(address);
  if (zip && ZIP_TO_NEIGHBORHOOD[zip]) return ZIP_TO_NEIGHBORHOOD[zip];

  const lower = String(address || "").toLowerCase();
  if (lower.includes("fairmount")) return "Fairmount";
  if (lower.includes("brewerytown")) return "Brewerytown";
  if (lower.includes("spring garden")) return "Spring Garden";
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
export function pickFallbackImage(neighborhood) {
  const n = String(neighborhood || "").toLowerCase();
  if (n.includes("fairmount")) return FALLBACK_IMAGES.Fairmount;
  if (n.includes("brewerytown")) return FALLBACK_IMAGES.Brewerytown;
  return FALLBACK_IMAGES._default;
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
      const venue = e._embedded?.venues?.[0] || {};
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
      };
    });
}

// ---------------------------------------------------------------------------
// Normalize ONE event object from a given source into canonical shape.
// ---------------------------------------------------------------------------
function normalizeOne(rawEvent, source) {
  const r = renameFields(rawEvent, source.id);

  const address = r.address || "";
  const neighborhood = deriveNeighborhood(address, r.neighborhood);
  const zip = zipFrom(address);
  const isBigZip = zip ? BIG_EVENT_ZIPS.has(zip) : false;

  const image_url =
    r.image_url && String(r.image_url).trim()
      ? r.image_url
      : pickFallbackImage(neighborhood);
  const usedFallback = !(r.image_url && String(r.image_url).trim());

  return {
    id: r.id || `${source.id}-${(r.title || "untitled").slice(0, 40)}-${r.start_date || ""}`,
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
    priority: derivePriority(neighborhood),
    event_url: r.event_url || "",
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
export function buildEvents(rawBySource) {
  const dropped = { invalid: 0, hidden: 0, deduped: 0 };
  let all = [];

  for (const source of SOURCES) {
    const raw = rawBySource[source.id];
    if (!raw) continue;

    let items;
    if (source.id === "ticketmaster") {
      items = normalizeTicketmaster(raw).map((e) =>
        normalizeOne(e, source)
      );
    } else {
      items = extractArray(raw).map((e) => normalizeOne(e, source));
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

  // sort by date ascending; undated already dropped by validation
  all.sort((a, b) => a.start_date.localeCompare(b.start_date));

  return { events: all, dropped };
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
