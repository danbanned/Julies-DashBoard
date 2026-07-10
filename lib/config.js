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
  { id: "carto",         file: "cartomapsphiladelphia_events.json", label: "Carto (City)", bigByDefault: false },
];

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
// When an event has no image_url, pick a fallback by neighborhood.
// Files live in /public/fallbacks/. Matching is case-insensitive & partial
// (see pickFallbackImage in normalize.js), so "East Fairmount" hits Fairmount.
// ---------------------------------------------------------------------------
export const FALLBACK_IMAGES = {
  Fairmount:    "/fallbacks/airmountpark.png",
  Brewerytown:  "/fallbacks/brewerytownmap.webp",
  _default:     "/fallbacks/city.jpg", // everything else = Center City skyline
};

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
  visitphilly: {
    event_name: "title",
    venue_name: "location",
    street_address: "address",
    cost: "fee",
  },
  caldergardens: {
    event_name: "title",
    venue_name: "location",
    street_address: "address",
    cost: "fee",
  },
  sunsetsocial: {
    event_name: "title",
    venue_name: "location",
    street_address: "address",
    cost: "fee",
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
  },
  // Ticketmaster is normalized in normalize.js (nested structure), not here.
  ticketmaster: {},
};
