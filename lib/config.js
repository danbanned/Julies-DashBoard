// ============================================================================
// config.js — Julie's Events Dashboard
// ----------------------------------------------------------------------------
// EVERYTHING you'd want to tweak lives here. No logic below this file needs
// editing to change behavior — just the values in this file.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. SOURCE FILES
// ---------------------------------------------------------------------------
// Each source drops its own JSON file in /data (n8n GitHub node commits here).
// Add or remove a line to add/remove a source — the dashboard reads them all.
// `id` is used internally; `label` shows nowhere yet but is handy for debugging.
// `bigByDefault: true` means events from this source are always shown regardless
// of location (curated/ticketed sources — see visibility rule in normalize.js).
// ---------------------------------------------------------------------------
export const SOURCES = [
  { id: "ticketmaster",  file: "ticketmaster_events.json",         label: "Ticketmaster", bigByDefault: true  },
  { id: "visitphilly",   file: "visitphilly_events.json",          label: "Visit Philly", bigByDefault: true  },
  { id: "caldergardens", file: "caldergardensEvents.json",         label: "Calder Gardens", bigByDefault: true },
  { id: "sunsetsocial",  file: "sunsetsocialphl_movienights.json", label: "Sunset Social", bigByDefault: true },
  { id: "moviematinees", file: "movie-matineesevents.json",        label: "Movie Matinees", bigByDefault: true },
  { id: "carto",         file: "cartomapsphiladelphia_events.json", label: "Carto (City)", bigByDefault: false },
];

// ---------------------------------------------------------------------------
// 1b. DEFAULT LINK PER SOURCE
// ---------------------------------------------------------------------------
// Cards without a real event_url fall back to their source's listing page so
// every card is tappable (Julie's request — a listing page beats a dead card).
// A real per-event link always wins over these.
// ---------------------------------------------------------------------------
export const DEFAULT_SOURCE_URL = {
  ticketmaster:  "https://www.ticketmaster.com/discover/concerts/philadelphia",
  visitphilly:   "https://www.visitphilly.com/events/",
  caldergardens: "https://caldergardens.org/programs/",
  sunsetsocial:  "https://www.sunsetsocialphl.com/movie-nights",
  moviematinees: "https://www.sunsetsocialphl.com/movie-matinees",
  carto:         "https://www.phila.gov/calendar/",
};

// ---------------------------------------------------------------------------
// 2. ZIP -> NEIGHBORHOOD
// ---------------------------------------------------------------------------
// Derived from address/facility_address text. First match wins.
// Add zips as you learn them. Anything unmatched becomes "Other".
// ---------------------------------------------------------------------------
export const ZIP_TO_NEIGHBORHOOD = {
  "19130": "Fairmount",
  "19121": "Brewerytown",
  "19123": "Spring Garden",
  "19146": "Fitler Square",
  "19102": "Center City",
  "19103": "Rittenhouse",
  "19106": "Old City",
  "19107": "Center City",
  "19148": "South Philly (Stadiums)",
  "19125": "Fishtown",
  "19122": "Northern Liberties",
  "19104": "University City",
};

// Canonical neighborhood labels. A source-provided `neighborhood` value is only
// trusted if it matches one of these (case-insensitive); anything else
// ("Unknown", "Benjamin Franklin Parkway", a street name) is ignored and the
// neighborhood is derived from the address zip instead. Keeps chip labels and
// priority tiers consistent no matter what n8n sends.
export const KNOWN_NEIGHBORHOODS = new Set([
  ...Object.values(ZIP_TO_NEIGHBORHOOD),
  "Fairmount Park",
]);

// ---------------------------------------------------------------------------
// 2b. NEIGHBORHOOD CENTROIDS (approximate)
// ---------------------------------------------------------------------------
// No source currently provides lat/lng, so events fall back to their
// neighborhood's centroid for map markers. Events in "Other" (no centroid)
// simply don't get a marker. Refine coordinates freely.
// ---------------------------------------------------------------------------
export const NEIGHBORHOOD_CENTROIDS = {
  "Fairmount":               { lat: 39.9672, lng: -75.1804 },
  "Brewerytown":             { lat: 39.9756, lng: -75.1866 },
  "Spring Garden":           { lat: 39.9634, lng: -75.1548 },
  "Center City":             { lat: 39.9526, lng: -75.1652 },
  "Rittenhouse":             { lat: 39.9496, lng: -75.1717 },
  "Old City":                { lat: 39.9520, lng: -75.1450 },
  "University City":         { lat: 39.9522, lng: -75.1932 },
  "Fishtown":                { lat: 39.9720, lng: -75.1300 },
  "Northern Liberties":      { lat: 39.9640, lng: -75.1420 },
  "Fitler Square":           { lat: 39.9480, lng: -75.1780 },
  "South Philly (Stadiums)": { lat: 39.9057, lng: -75.1670 },
};

// ---------------------------------------------------------------------------
// 3. BIG-EVENT ZIPS
// ---------------------------------------------------------------------------
// Zips where major events reliably happen. Any event in one of these is shown
// regardless of source or size — venue locations rarely change, so this list
// is stable. (South Philly complex, the Parkway, Center City, Old City.)
// ---------------------------------------------------------------------------
export const BIG_EVENT_ZIPS = new Set([
  "19148", // Citizens Bank Park, Lincoln Financial, Xfinity Mobile Arena, Xfinity Live!
  "19130", // PMA / Parkway / Eakins Oval — parades, marathon, concerts
  "19102", // Center City / Logan Square (Parkway east end, Dilworth-adjacent)
  "19103", // Rittenhouse / Parkway
  "19106", // Old City / Independence Mall / Franklin Square
  "19121", // Brewerytown (Julie's core — always show)
]);

// ---------------------------------------------------------------------------
// 4. PRIORITY TIERS
// ---------------------------------------------------------------------------
// Drives the "High / Medium / Low Priority" badges and the Priority Overview.
// This is a DERIVED layer — no source provides priority. Edit freely.
// ---------------------------------------------------------------------------
export const HIGH_PRIORITY_NEIGHBORHOODS = new Set(["Fairmount", "Brewerytown"]);
export const MEDIUM_PRIORITY_NEIGHBORHOODS = new Set([
  "Spring Garden", "Fitler Square", "Fairmount Park",
]);
// Everything shown but not in the above two sets = Low.

// ---------------------------------------------------------------------------
// 5. IMAGE FALLBACKS
// ---------------------------------------------------------------------------
// When an event has no image_url, a random photo is picked from the event's
// neighborhood folder (stable per event — seeded by event id). Folder names
// must match the on-disk casing EXACTLY (deploy hosts are case-sensitive).
// Matching is case-insensitive & partial ("East Fairmount" hits fairmount).
// loadEvents.js reads these folders server-side and builds the manifest.
// ---------------------------------------------------------------------------
export const FALLBACK_DIRS = {
  fairmount:   "FairMount",
  brewerytown: "BreweryTown",
  default:     "Philadelphia", // everything else
};
// Last-resort single image if a folder is missing/empty.
export const FALLBACK_STATIC = "/fallbacks/Philadelphia/city.jpg";

// ---------------------------------------------------------------------------
// 5b. STREAK CARD IMAGES (Phase 10f)
// ---------------------------------------------------------------------------
// The Daily Streak panel background rotates weekly by PLAIN rotation
// (week-of-year % count). Drop in streak-6.jpg etc. and bump the count.
// ---------------------------------------------------------------------------
export const STREAK_IMAGE_COUNT = 5;
export const streakImagePath = (n) => `/streak/streak-${n}.jpg`;

// ---------------------------------------------------------------------------
// 6. FIELD NAME MAPPING (per source)
// ---------------------------------------------------------------------------
// Sources return different key names for the same thing. Map each source's
// raw keys -> our canonical keys. Canonical keys (right side) are what the UI
// reads. If a source already uses a canonical name, no entry needed.
//
// Canonical fields:
//   id, title, description, category, location, address, fee, fee_frequency,
//   start_date, end_date, start_time, end_time, days, neighborhood,
//   event_url, image_url, source
// ---------------------------------------------------------------------------
export const FIELD_MAP = {
  // Oxylabs-scraped sources came back with these names (event_name, etc.)
  // n8n-committed files put the event URL under `slug` — map it everywhere.
  visitphilly: {
    event_name: "title",
    venue_name: "location",
    street_address: "address",
    cost: "fee",
    slug: "event_url",
  },
  caldergardens: {
    event_name: "title",
    venue_name: "location",
    street_address: "address",
    cost: "fee",
    slug: "event_url",
    category_id: "category",
  },
  // Sunset Social pages (movie nights + matinees) already use canonical names
  // for title/location/address/fee/dates — only these two need renaming.
  sunsetsocial: {
    slug: "event_url",
    category_id: "category",
  },
  moviematinees: {
    slug: "event_url",
    category_id: "category",
  },
  // Carto SQL returns program_* names
  carto: {
    program_name: "title",
    program_description: "description",
    activity_category: "category",
    facility_name: "location",
    facility_address: "address",
    date_from: "start_date",
    date_to: "end_date",
    time_from: "start_time",
    time_to: "end_time",
    slug: "event_url",
    category_id: "category",
  },
  // Ticketmaster's raw nested API shape is flattened in normalize.js; the
  // n8n-committed flat shape flows through here like any other source.
  ticketmaster: {
    slug: "event_url",
    category_id: "category",
  },
};
