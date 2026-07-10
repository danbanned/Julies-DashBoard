// lib/loadEvents.js — server-side: read committed JSON files, normalize, return.
import { readFileSync } from "fs";
import path from "path";
import { SOURCES } from "./config";
import { buildEvents, neighborhoodsFrom } from "./normalize";

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
  const { events, dropped } = buildEvents(rawBySource);
  const chips = neighborhoodsFrom(events);
  return { events, dropped, chips };
}
