"use client";

// "The Walkway": a desktop-only (>=1024px) wayfinding rail, purely additive —
// mobile/tablet bottom nav and drawer are untouched. Mirrors ViewerApp's real
// destinations exactly for everything that isn't in question. The Family
// Chat vs. Newsletter slot is intentionally left a placeholder — see the
// TODO below — pending that open question's resolution
// (phase24_layout_theme_settings.md, "Corrections" #2).
//
// Correction pass: was a permanently fixed 180px-wide rail, which ate real
// content width regardless of Layout choice (directly undermining Full
// Width's whole point). Now hidden off-screen by default, revealed via a
// small always-visible edge handle — applies the same way across every
// Layout (confirmed), not just Full Width.
import { useState } from "react";
import styles from "../app/Events.module.css";

// TODO: Family Chat vs. Newsletter destination is unresolved — confirm with
// Julie whether /chat (Weekly Neighborhood Events) is the right destination
// here, or something else, before adding it to this list.
function buildDestinations({ user, view, setView }) {
  const items = [
    { key: "home", label: "Home", icon: "🏠", active: view === "home", onClick: () => setView("home") },
  ];
  if (user) {
    items.push({ key: "events", label: "Events", icon: "🗓️", active: view === "events", onClick: () => setView("events") });
    items.push({ key: "calendar", label: "Calendar", icon: "📅", active: view === "calendar", onClick: () => setView("calendar") });
  }
  items.push({ key: "favorites", label: "Favorites", icon: "♥", active: view === "favorites", onClick: () => setView("favorites") });
  items.push({ key: "profile", label: "Profile", icon: "👤", active: view === "profile", onClick: () => setView("profile") });
  items.push({ key: "work-with-julie", label: "Work with Julie", icon: "📞", href: "/work-with-julie" });
  // { key: "chat-or-newsletter", label: "TBD", href: "TBD" } — see TODO above
  return items;
}

export default function WalkwayRail({ user, view, setView }) {
  const [open, setOpen] = useState(false);
  const destinations = buildDestinations({ user, view, setView });
  return (
    <>
      <button
        type="button"
        className={styles.walkwayHandle}
        aria-label={open ? "Hide navigation rail" : "Show navigation rail"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "‹" : "›"}
      </button>
      <nav className={styles.walkwayRail} aria-label="Site navigation" data-open={open}>
        {destinations.map((d) =>
          d.href ? (
            <a key={d.key} className={styles.walkwayItem} href={d.href}>
              <span className={styles.walkwayIcon}>{d.icon}</span>{d.label}
            </a>
          ) : (
            <button key={d.key} type="button" className={styles.walkwayItem} data-active={d.active} onClick={d.onClick}>
              <span className={styles.walkwayIcon}>{d.icon}</span>{d.label}
            </button>
          )
        )}
      </nav>
    </>
  );
}
