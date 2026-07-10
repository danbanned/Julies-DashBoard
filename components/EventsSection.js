"use client";

import { useMemo, useState } from "react";
import styles from "../app/Events.module.css";
import EventsMap, { hasMapsKey } from "./EventsMap";
import {
  getImpactStats,
  getStreakData,
  getNotifications,
  getAchievements,
} from "../lib/stats";

// All gamification numbers come from lib/stats.js — honest zeros until real
// sources exist (Phase 6 rule). Components only render what these return.
const IMPACT = getImpactStats();
const ACHIEVEMENTS = getAchievements();
// Core neighborhoods pinned on the "What's Happening Where" panel (mockup).
const MAP_HOODS = [
  { name: "Fairmount", color: "var(--green)" },
  { name: "Brewerytown", color: "var(--red)" },
  { name: "Spring Garden", color: "var(--amber)" },
];

// pretty date: "2026-07-19" -> { mo: "JUL", day: "19", dow: "SAT" }
function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const mo = dt.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dow = dt.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
  return { mo, day: String(d), dow };
}

function fmtTime(t) {
  if (!t) return "";
  t = String(t);
  if (t.includes("T")) t = t.split("T")[1]; // Carto sends ISO timestamps
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

function EventCard({ ev }) {
  const { mo, day, dow } = fmtDate(ev.start_date);
  const time = fmtTime(ev.start_time);
  const Wrapper = ev.event_url ? "a" : "div";
  const wrapperProps = ev.event_url
    ? { href: ev.event_url, target: "_blank", rel: "noopener noreferrer" }
    : {};
  return (
    <Wrapper className={styles.card} data-link={ev.event_url ? "true" : "false"} {...wrapperProps}>
      <div className={styles.thumb}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ev.image_url} alt="" loading="lazy" />
        <span className={styles.badge} data-p={ev.priority}>
          {ev.priority} priority
        </span>
        {ev.new_since_last && <span className={styles.newDot}>NEW</span>}
      </div>
      <div className={styles.dateCol} data-p={ev.priority}>
        <span className={styles.dateMo}>{mo}</span>
        <span className={styles.dateDay}>{day}</span>
        <span className={styles.dateDow}>{dow}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.title}>{ev.title}</div>
        <div className={styles.meta}>
          {ev.location}
          {time ? ` · ${time}` : ""}
          {ev.fee ? ` · ${ev.fee}` : ""}
        </div>
        {ev.description && <div className={styles.desc}>{ev.description}</div>}
        <div className={styles.tags}>
          <span className={styles.tag} data-hood={ev.neighborhood}>
            {ev.neighborhood}
          </span>
          {ev.category && <span className={styles.tag}>{ev.category}</span>}
        </div>
      </div>
      {ev.event_url && <span className={styles.chev} aria-hidden="true">›</span>}
    </Wrapper>
  );
}

export default function EventsSection({ events, chips }) {
  const [active, setActive] = useState("All");
  const [linksOnly, setLinksOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Streak week depends on "today", so compute it client-side per render.
  const streak = useMemo(() => getStreakData(), []);

  // "Has Links" is a toggle that ANDs with the active neighborhood chip.
  const base = useMemo(
    () => (linksOnly ? events.filter((e) => e.event_url) : events),
    [linksOnly, events]
  );

  const filtered = useMemo(() => {
    if (active === "All") return base;
    return base.filter((e) => e.neighborhood === active);
  }, [active, base]);

  // Chip counts reflect the other active filter so counts always match the list.
  const chipCounts = useMemo(() => {
    const c = {};
    for (const e of base) c[e.neighborhood] = (c[e.neighborhood] || 0) + 1;
    return c;
  }, [base]);

  const linkableCount = useMemo(
    () => events.filter((e) => e.event_url).length,
    [events]
  );

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const e of filtered) c[e.priority]++;
    return c;
  }, [filtered]);

  // Bell badge = unread notifications (Phase 5). None wired yet → no badge.
  const unreadCount = getNotifications().length;

  const hoodTotals = useMemo(() => {
    const c = {};
    for (const e of events) c[e.neighborhood] = (c[e.neighborhood] || 0) + 1;
    return c;
  }, [events]);

  // Map markers: every event we could place (real geo or hood centroid).
  const mapPoints = useMemo(
    () =>
      events
        .filter((e) => e.lat != null && e.lng != null)
        .map((e) => ({ lat: e.lat, lng: e.lng, exact: e.geoExact, title: e.title })),
    [events]
  );

  return (
    <div className={styles.shell}>
      {/* ---------- 1. top header bar ---------- */}
      <header className={styles.topBar}>
        <button
          className={styles.iconBtn}
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>
        <div className={styles.hello}>
          <h1>Hi Julie! 👋</h1>
          <p>New events. New opportunities.</p>
        </div>
        <button className={styles.iconBtn} aria-label="Notifications">
          🔔
          {unreadCount > 0 && (
            <span className={styles.bellBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
        </button>
      </header>

      {/* hamburger drawer */}
      {menuOpen && (
        <div className={styles.drawerScrim} onClick={() => setMenuOpen(false)}>
          <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHead}>
              <h3>Menu</h3>
              <button
                className={styles.iconBtn}
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                ✕
              </button>
            </div>
            <h4>About App</h4>
            <p>
              Julie&apos;s Dashboard surfaces upcoming events across Fairmount,
              Brewerytown and Spring Garden that are perfect for real-estate
              content. Events sync automatically every morning at 9am from
              Ticketmaster, Visit Philly, the City of Philadelphia and more.
            </p>
          </aside>
        </div>
      )}

      {/* ---------- 2. stats row: Your Impact + Daily Streak ---------- */}
      <section className={styles.statsRow}>
        <div className={styles.impactCard}>
          <div className={styles.impactLeft}>
            <h2>⭐ Your Impact</h2>
            <p className={styles.impactBlurb}>
              Keep showing Philly what makes our neighborhoods special!
            </p>
            <div className={styles.impactStats}>
              <div className={styles.impactStat}>
                <span className={styles.impactLabel}>Events Shared</span>
                <span className={styles.impactNum} data-c="purple">{IMPACT.eventsShared}</span>
                <span className={styles.impactSub}>This Month</span>
              </div>
              <div className={styles.impactStat}>
                <span className={styles.impactLabel}>Profile Views</span>
                <span className={styles.impactNum} data-c="green">{IMPACT.profileViews}</span>
                <span className={styles.impactSub}>This Month</span>
              </div>
            </div>
            <div className={styles.nextLevel}>
              <span>{IMPACT.nextLevelCopy}</span>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${IMPACT.progressPct}%` }} />
              </div>
            </div>
          </div>
          <div
            className={styles.levelRing}
            style={{
              background: `conic-gradient(var(--purple) 0 ${IMPACT.progressPct}%, #e8e6fa ${IMPACT.progressPct}% 100%)`,
            }}
          >
            <div className={styles.levelRingInner}>
              <span className={styles.levelNum}>Level {IMPACT.level}</span>
              <span className={styles.levelName}>{IMPACT.levelName}</span>
              <span className={styles.levelTrophy}>🏆</span>
            </div>
          </div>
        </div>

        <div className={styles.streakCard}>
          <h2>Daily Streak 🔥</h2>
          <div className={styles.streakNum}>{streak.days}</div>
          <div className={styles.streakSub}>
            {streak.days > 0 ? "Days in a row!" : "Check in daily to start a streak"}
          </div>
          <div className={styles.streakWeek}>
            {streak.week.map((w, i) => (
              <span key={i} className={styles.streakDay} data-done={w.done}>
                <b>{w.done ? "✓" : ""}</b>
                <em>{w.d}</em>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 3. filter chips — auto-generated from real neighborhoods ---------- */}
      <div className={styles.chips}>
        <button
          className={styles.chip}
          data-active={active === "All"}
          onClick={() => setActive("All")}
        >
          📍 All Areas
          <span className={styles.chipCount}>{base.length}</span>
        </button>
        {chips.map((c) => (
          <button
            key={c.name}
            className={styles.chip}
            data-active={active === c.name}
            onClick={() => setActive(c.name)}
          >
            {c.name}
            <span className={styles.chipCount}>{chipCounts[c.name] || 0}</span>
          </button>
        ))}
        <button
          className={styles.chip}
          data-active={linksOnly}
          onClick={() => setLinksOnly((v) => !v)}
          title="Only show events with a ticket/info link"
        >
          🔗 Has Links
          <span className={styles.chipCount}>{linkableCount}</span>
        </button>
      </div>

      {/* ---------- 4. upcoming events (fixed-height scroll box) ---------- */}
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>⭐ Upcoming Events</h2>
          <span className={styles.seeAll}>See Calendar ›</span>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <h3>No events here yet</h3>
            <p>
              When the morning sync runs, new {active === "All" ? "" : active + " "}
              events land here automatically. Check back after 9am, or pick a
              different area above.
            </p>
          </div>
        ) : (
          <div className={styles.scrollBox}>
            <div className={styles.list}>
              {filtered.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---------- 5. priority overview + what's happening where ---------- */}
      <section className={styles.twoCol}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>🎯 Priority Overview</h2>
          </div>
          <div className={styles.overview}>
            <div className={styles.ovRow}>
              <span className={styles.ovLabel}>🔴 High Priority</span>
              <span className={styles.ovCount} data-c="red">{counts.high}</span>
            </div>
            <div className={styles.ovRow}>
              <span className={styles.ovLabel}>🟠 Medium Priority</span>
              <span className={styles.ovCount} data-c="amber">{counts.medium}</span>
            </div>
            <div className={styles.ovRow}>
              <span className={styles.ovLabel}>🟢 Low Priority</span>
              <span className={styles.ovCount} data-c="green">{counts.low}</span>
            </div>
            <div className={styles.ovRow}>
              <span className={styles.ovLabel}>Total Upcoming</span>
              <span className={styles.ovTotal}>{filtered.length}</span>
            </div>
          </div>
        </div>

        <div className={styles.mapPanel}>
          <div className={styles.mapHead}>
            <h2>📍 What&apos;s Happening Where</h2>
          </div>
          {/* Real Google Map when a key is configured; the bubble row always
              shows live counts and doubles as the no-key fallback. */}
          {hasMapsKey && <EventsMap points={mapPoints} className={styles.mapCanvas} />}
          <div className={styles.mapBubbles} data-compact={hasMapsKey}>
            {MAP_HOODS.map((h) => (
              <div key={h.name} className={styles.mapHood}>
                <span className={styles.mapCount} style={{ background: h.color }}>
                  {hoodTotals[h.name] || 0}
                </span>
                <span className={styles.mapName}>{h.name}</span>
              </div>
            ))}
          </div>
          <button className={styles.mapBtn}>
            🔍 View Full Map <span aria-hidden="true">›</span>
          </button>
        </div>
      </section>

      {/* ---------- 6. achievements ---------- */}
      <div className={styles.achievePanel}>
        <div className={styles.panelHead}>
          <h2>🏆 Achievements</h2>
          <span className={styles.achieveNote}>You&apos;re doing amazing!</span>
          <span className={styles.seeAll}>View All ›</span>
        </div>
        <div className={styles.achieveRow}>
          {ACHIEVEMENTS.map((a) => (
            <div key={a.label} className={styles.achieveItem} data-locked={!a.unlocked}>
              <span className={styles.achieveIcon}>{a.icon}</span>
              <span className={styles.achieveLabel}>{a.label}</span>
              {a.note && <span className={styles.achieveSub}>{a.note}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- 7. bottom navigation ---------- */}
      <nav className={styles.bottomNav}>
        <button className={styles.navItem} data-active="true">
          <span>🏠</span>Dashboard
        </button>
        <button className={styles.navItem}>
          <span>📅</span>Events
        </button>
        <button className={styles.navAdd} aria-label="Add Event">
          <span className={styles.navAddCircle}>＋</span>
          <em>Add Event</em>
        </button>
        <button className={styles.navItem}>
          <span>🤍</span>Favorites
        </button>
        <button className={styles.navItem}>
          <span>👤</span>Profile
        </button>
      </nav>
    </div>
  );
}
