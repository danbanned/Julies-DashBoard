// Newsletter subscriber domain logic (Phase 19). Kept separate from lib/crm.js
// on purpose — subscribers are never CRM leads and must never feed the CRM's
// actionability ranking.
export const NEIGHBORHOOD_OPTIONS = ["Fairmount", "Brewerytown", "University City"];

// Normalizes a requested neighborhood list: "All" collapses to the full set
// (so digest matching is a single `some()` check, not a special case), unknown
// values are dropped, duplicates removed.
export function normalizeNeighborhoods(raw) {
  const list = Array.isArray(raw) ? raw : [];
  if (list.some((n) => String(n).trim().toLowerCase() === "all")) {
    return [...NEIGHBORHOOD_OPTIONS];
  }
  const set = new Set(list.map((n) => String(n).trim()).filter((n) => NEIGHBORHOOD_OPTIONS.includes(n)));
  return [...set];
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}
