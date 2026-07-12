"use client";

// Persisted notification store for the header bell (Phase 10.1).
// One localStorage key, capped list, id-dedupe. All storage access happens
// client-side (SSR-safe) and is wrapped in try/catch so corrupt/absent JSON
// never crashes the bell.
import { useCallback, useEffect, useState } from "react";

const KEY = "julie-notifications";
const CAP = 50; // most recent N kept so the list can't grow unbounded

function persist(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
}

export function useNotifications() {
  const [items, setItems] = useState([]);

  // Rehydrate on mount. MERGE with anything already in state — an SSE
  // message can land before this effect runs, and must not be lost.
  useEffect(() => {
    let stored = [];
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) stored = parsed;
    } catch {}
    setItems((prev) => {
      const seen = new Set(stored.map((n) => n.id));
      const merged = [...prev.filter((n) => !seen.has(n.id)), ...stored].slice(0, CAP);
      persist(merged);
      return merged;
    });
  }, []);

  // Insert one incoming message; dedupe by id against the persisted array
  // (covers ntfy redelivery AND the same message seen across a refresh).
  const add = useCallback((n) => {
    setItems((prev) => {
      if (!n?.id || prev.some((x) => x.id === n.id)) return prev;
      const next = [
        { id: n.id, title: n.title || "New Philly event", message: n.message || "", time: n.time || Date.now(), read: false },
        ...prev,
      ].slice(0, CAP);
      persist(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      if (!prev.some((x) => !x.read)) return prev;
      const next = prev.map((x) => (x.read ? x : { ...x, read: true }));
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems(() => {
      persist([]);
      return [];
    });
  }, []);

  const unread = items.reduce((n, x) => n + (x.read ? 0 : 1), 0);
  return { items, unread, add, markAllRead, clearAll };
}

// "2h ago" style relative time for popout rows.
export function relTime(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
