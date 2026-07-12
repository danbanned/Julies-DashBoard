// lib/loadEvents.js — server-side: read committed JSON files, normalize, return.
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { SOURCES, FALLBACK_DIRS } from "./config";
import { buildEvents, neighborhoodsFrom } from "./normalize";

// List the fallback images available per neighborhood folder (7g). Runs
// server-side only — the browser can't list directories. Missing folders
// yield an empty list and pickFallbackImage degrades to FALLBACK_STATIC.
function fallbackManifest() {
  const root = path.join(process.cwd(), "public", "fallbacks");
  const manifest = {};
  for (const [key, dir] of Object.entries(FALLBACK_DIRS)) {
    try {
      manifest[key] = readdirSync(path.join(root, dir))
        .filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f))
        .map((f) => `/fallbacks/${dir}/${f}`);
    } catch {
      manifest[key] = [];
    }
  }
  return manifest;
}

export function loadEvents() {
  const rawBySource = {};
  for (const source of SOURCES) {
    try {
      const p = path.join(process.cwd(), "data", source.file);
      const txt = readFileSync(p, "utf8").trim();
      rawBySource[source.id] = txt ? JSON.parse(txt) : { events: [] };
    } catch {
      // File missing or malformed — skip this source, don't crash the page.
      rawBySource[source.id] = { events: [] };
    }
  }
  const { events, pastEvents, dropped } = buildEvents(rawBySource, fallbackManifest());
  const chips = neighborhoodsFrom(events); // chips count UPCOMING only
  return { events, pastEvents, dropped, chips };
}
