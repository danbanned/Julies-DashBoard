"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import styles from "../app/Events.module.css";
import EventsMap, { hasMapsKey } from "./EventsMap";
import ProfileView from "./ProfileView";
import CalendarView from "./CalendarView";
import AchievementsView from "./AchievementsView";
import EventAlerts from "./EventAlerts";
import PushSetup from "./PushSetup";
import AdminConsole from "./AdminConsole";
import AdminChat from "./AdminChat";
import { ACHIEVEMENT_DEFS } from "../lib/achievementDefs";
import { getImpactStats, getStreakData } from "../lib/stats";
import { STREAK_IMAGE_COUNT, streakImagePath } from "../lib/config";
import { useNotifications, relTime } from "../lib/useNotifications";

// time-based greeting for a dashboard she opens throughout the day (10d)
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning, Julie 🤍";
  if (h < 18) return "Good afternoon, Julie 🤍";
  return "Good evening, Julie 🤍";
}

// weekly plain rotation (10f): week-of-year % count → streak-{n}.jpg
function weeklyStreakImage() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.floor((now - jan1) / (7 * 86400000));
  return streakImagePath((week % STREAK_IMAGE_COUNT) + 1);
}

// date-range windows (10a); all as [startISO, endISO] inclusive
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function rangeWindows() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = today.getDay(); // 0 Sun .. 6 Sat
  // weekend: upcoming Sat+Sun; if it's already Sat/Sun, the current one
  const sat = new Date(today);
  sat.setDate(today.getDate() + (dow === 0 ? -1 : 6 - dow));
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  // week: today through the coming Sunday
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + ((7 - dow) % 7));
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const plus30 = new Date(today);
  plus30.setDate(today.getDate() + 30);
  return {
    weekend: [toISO(sat), toISO(sun)],
    week: [toISO(today), toISO(weekEnd)],
    month: [toISO(new Date(today.getFullYear(), today.getMonth(), 1)), toISO(monthEnd)],
    next30: [toISO(today), toISO(plus30)],
  };
}
// an event is "in" a window if its date range OVERLAPS it (multi-day events)
function overlaps(ev, [winStart, winEnd]) {
  const evEnd = ev.end_date || ev.start_date;
  return ev.start_date <= winEnd && evEnd >= winStart;
}

// "Soonest first" (10.2): DATE is the only real sort key — priority is a
// visual badge, never an ordering factor, except to break exact date ties
// (high → medium → low). Ongoing events live in their own section now, so
// this sorts purely by real start_date.
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
function byDateThenPriority(a, b) {
  return (
    a.start_date.localeCompare(b.start_date) ||
    (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3)
  );
}

// Ongoing = started already but still running (end today or later).
function isOngoing(ev, todayIso) {
  return ev.start_date < todayIso && (ev.end_date || ev.start_date) >= todayIso;
}
const RANGE_CHIPS = [
  { key: "all", label: "All dates" },
  { key: "weekend", label: "This Weekend" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "next30", label: "Next 30 Days" },
];

// Impact/streak still come from lib/stats.js zeros (Phase 6 rule);
// achievements are now live from the weekly engine (Phase 8h).
const IMPACT = getImpactStats();
// Core neighborhoods pinned on the "What's Happening Where" panel (mockup).
const MAP_HOODS = [
  { name: "Fairmount", color: "var(--green)" },
  { name: "Brewerytown", color: "var(--red)" },
  { name: "Spring Garden", color: "var(--amber)" },
];

// pretty date: "2026-07-19" -> { mo: "JUL", day: "19", dow: "SAT", yr: "2026" }
function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const mo = dt.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dow = dt.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
  return { mo, day: String(d), dow, yr: String(y) };
}

// "2026-01-01".."2026-12-26" -> "Jan 1 – Dec 26, 2026" (year once per range;
// both years shown only when the range crosses a year boundary)
function fmtRange(startIso, endIso) {
  const part = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const mon = new Date(y, m - 1, d).toLocaleString("en-US", { month: "short" });
    return { mon, d, y };
  };
  const a = part(startIso);
  const b = part(endIso);
  if (a.y === b.y) return `${a.mon} ${a.d} – ${b.mon} ${b.d}, ${a.y}`;
  return `${a.mon} ${a.d}, ${a.y} – ${b.mon} ${b.d}, ${b.y}`;
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

function EventCard({ ev, row, act }) {
  const { mo, day, dow, yr } = fmtDate(ev.start_date);
  const time = fmtTime(ev.start_time);
  const isRange = Boolean(ev.end_date && ev.end_date !== ev.start_date);
  const Wrapper = ev.event_url ? "a" : "div";
  const wrapperProps = ev.event_url
    ? {
        href: ev.event_url,
        target: "_blank",
        rel: "noopener noreferrer",
        // opening an event counts as a view — the achievement engine's signal
        onClick: () => act && act(ev, "view"),
      }
    : {};

  const btn = (action, value, icon, title, on) => (
    <button
      className={styles.actBtn}
      data-on={Boolean(on)}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        act(ev, action, value);
      }}
    >
      {icon}
    </button>
  );
  return (
    <Wrapper
      className={styles.card}
      data-link={ev.event_url ? "true" : "false"}
      data-new={ev.new_since_last ? "true" : "false"}
      {...wrapperProps}
    >
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
        <span className={styles.dateYr}>{yr}</span>
      </div>
      <div className={styles.body}>
        {isRange && (
          <div className={styles.rangeRow}>{fmtRange(ev.start_date, ev.end_date)}</div>
        )}
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
        {act && (
          <div className={styles.actions}>
            {btn("attended", !row?.attended, "✓", row?.attended ? "Attended — undo" : "Mark attended", row?.attended)}
            {btn("saved", !row?.saved, "🔖", row?.saved ? "Un-save" : "Save for later", row?.saved)}
            {btn("calendar", !row?.addedToCalendar, "📅", row?.addedToCalendar ? "Remove from my calendar" : "Add to my calendar", row?.addedToCalendar)}
            {btn("shared", true, "↗", row?.shared ? "Shared" : "Mark as shared", row?.shared)}
            {btn("posted", true, "📸", row?.posted ? "Posted" : "Mark as posted", row?.posted)}
          </div>
        )}
      </div>
      {ev.event_url && <span className={styles.chev} aria-hidden="true">›</span>}
    </Wrapper>
  );
}

export default function EventsSection({ events, pastEvents = [], chips, consoleData = null }) {
  const [active, setActive] = useState("All");
  const [linksOnly, setLinksOnly] = useState(false);
  const [highOnly, setHighOnly] = useState(false); // 18e: High Priority tier filter
  const [range, setRange] = useState("all"); // date sub-filter (10a)
  const [sortBy, setSortBy] = useState("soonest"); // soonest | newest (10b)
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [view, setView] = useState("dashboard"); // dashboard | profile | calendar | achievements

  const router = useRouter();

  // Julie's per-event state (attended/saved/planned/…), keyed by eventId.
  const [inter, setInter] = useState({});
  const [ach, setAch] = useState(null); // { weekStart, week, history }
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalNotice, setGcalNotice] = useState("");

  const refreshGcal = useCallback(() => {
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then((d) => setGcalConnected(Boolean(d.connected)))
      .catch(() => {});
  }, []);

  // Returning from the Google consent redirect: show the outcome and land
  // on the calendar view so the result is visible.
  useEffect(() => {
    refreshGcal();
    const flag = new URLSearchParams(window.location.search).get("gcal");
    if (!flag) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (flag === "synced") setGcalNotice("✅ Google Calendar connected — your event was added.");
    else if (flag === "connected") setGcalNotice("✅ Google Calendar connected.");
    else setGcalNotice("Something went wrong connecting Google Calendar — try again.");
    setView("calendar");
  }, [refreshGcal]);

  useEffect(() => {
    fetch("/api/interactions")
      .then((r) => r.json())
      .then((d) => {
        const m = {};
        for (const row of d.interactions || []) m[row.eventId] = row;
        setInter(m);
      })
      .catch(() => {});
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((d) => d?.week && setAch(d))
      .catch(() => {});
  }, []);

  const refreshInteractions = useCallback(() => {
    fetch("/api/interactions")
      .then((r) => r.json())
      .then((d) => {
        const m = {};
        for (const row of d.interactions || []) m[row.eventId] = row;
        setInter(m);
      })
      .catch(() => {});
  }, []);

  // Write one action to the DB (optimistic UI). `ev` is a feed event or a
  // minimal { id } when acting from Profile/Calendar rows.
  const act = useCallback((ev, action, value = true) => {
    const flags = {
      attended: { attended: value, attendedAt: value ? new Date().toISOString() : null },
      saved: { saved: value, savedAt: value ? new Date().toISOString() : null },
      calendar: { addedToCalendar: value },
      shared: { shared: true },
      posted: { posted: true },
      view: {},
    }[action];
    setInter((prev) => ({
      ...prev,
      [ev.id]: {
        eventId: ev.id,
        eventTitle: ev.title || prev[ev.id]?.eventTitle || "",
        eventStartDate: ev.start_date || prev[ev.id]?.eventStartDate,
        views: prev[ev.id]?.views || 0,
        ...prev[ev.id],
        ...flags,
      },
    }));
    fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: action === "view", // survives the card's navigation
      body: JSON.stringify({
        eventId: ev.id,
        action,
        value,
        snapshot: {
          title: ev.title,
          start_date: ev.start_date,
          end_date: ev.end_date,
          event_url: ev.event_url,
          location: ev.location,
          neighborhood: ev.neighborhood,
          source: ev.source,
        },
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.interaction) setInter((p) => ({ ...p, [d.interaction.eventId]: d.interaction }));
        if (d.achievements) setAch((a) => ({ ...(a || { history: [] }), week: d.achievements }));
      })
      .catch(() => {});
  }, []);

  // Streak week depends on "today", so compute it client-side per render.
  const streak = useMemo(() => getStreakData(), []);

  // Attended events leave the main feed (8d) and live under the ✓ chip.
  const attendedIds = useMemo(
    () => new Set(Object.values(inter).filter((r) => r.attended).map((r) => r.eventId)),
    [inter]
  );
  const notAttended = useMemo(
    () => events.filter((e) => !attendedIds.has(e.id)),
    [events, attendedIds]
  );

  // "Has Links" = events with a REAL per-event link (source-default links
  // make every card tappable, so they don't count here). ANDs with the chip.
  const base = useMemo(
    () => {
      let list = linksOnly ? notAttended.filter((e) => e.has_real_url) : notAttended;
      // 18e: High Priority = the derived neighborhood tier (Fairmount/Brewerytown
      // → "high"). Composes with the other filters via AND, like Has Links.
      if (highOnly) list = list.filter((e) => e.priority === "high");
      return list;
    },
    [linksOnly, highOnly, notAttended]
  );

  const windows = useMemo(() => rangeWindows(), []);

  // neighborhood AND has-links applied; date range comes next (10a)
  const hoodFiltered = useMemo(() => {
    if (active === "All") return base;
    return base.filter((e) => e.neighborhood === active);
  }, [active, base]);

  const rangeCounts = useMemo(() => {
    const c = { all: hoodFiltered.length };
    for (const { key } of RANGE_CHIPS) {
      if (key !== "all") c[key] = hoodFiltered.filter((e) => overlaps(e, windows[key])).length;
    }
    return c;
  }, [hoodFiltered, windows]);

  // Combined post-filter list — chip counts and Priority Overview count
  // Ongoing + Upcoming together (both actionable), excluding only Past.
  const filtered = useMemo(() => {
    if (active === "__attended") return events.filter((e) => attendedIds.has(e.id));
    return range === "all" ? hoodFiltered : hoodFiltered.filter((e) => overlaps(e, windows[range]));
  }, [active, hoodFiltered, range, windows, events, attendedIds]);

  // Split into Ongoing (started, still running) and Upcoming (starts today or
  // later). Ongoing always sorts by date; Upcoming follows the sort toggle.
  const { ongoing, upcoming } = useMemo(() => {
    if (active === "__attended") return { ongoing: [], upcoming: filtered };
    const todayIso = toISO(new Date());
    const on = [];
    const up = [];
    for (const e of filtered) (isOngoing(e, todayIso) ? on : up).push(e);
    on.sort(byDateThenPriority);
    if (sortBy === "newest") {
      // newest-synced first; events without ingested_at fall back to date order
      up.sort(
        (a, b) =>
          String(b.ingested_at || "").localeCompare(String(a.ingested_at || "")) ||
          a.start_date.localeCompare(b.start_date)
      );
    } else {
      up.sort(byDateThenPriority); // hard re-sort — never trust upstream order
    }
    return { ongoing: on, upcoming: up };
  }, [filtered, sortBy, active]);

  // Chip counts reflect the other active filter so counts always match the list.
  const chipCounts = useMemo(() => {
    const c = {};
    for (const e of base) c[e.neighborhood] = (c[e.neighborhood] || 0) + 1;
    return c;
  }, [base]);

  const linkableCount = useMemo(
    () => events.filter((e) => e.has_real_url).length,
    [events]
  );

  // 18e: count of high-priority (not-yet-attended) events for the chip badge
  const highCount = useMemo(
    () => notAttended.filter((e) => e.priority === "high").length,
    [notAttended]
  );

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const e of filtered) c[e.priority]++;
    return c;
  }, [filtered]);

  // Bell = real ntfy notifications, persisted in localStorage (10.1).
  const notif = useNotifications();
  const [bellOpen, setBellOpen] = useState(false);
  const toggleBell = useCallback(() => {
    setBellOpen((open) => {
      if (!open) notif.markAllRead(); // opening the popout clears the badge
      return !open; 
    });
  }, [notif]);

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.iconImg} src="/icons/menu.png" alt="" />
        </button>
        <div className={styles.hello}>
          <h1>{greeting()}</h1>
          <p>Find beauty. Share community. Grow your brand.</p>
          {/* eslint-disable @next/next/no-img-element */}
          <div className={styles.socialRow}>
            <a
              className={styles.socialLink}
              href="https://www.instagram.com/julietoursphilly/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Julie on Threads"
            >
              <img src="/icons/threads.png" alt="Threads" />
            </a>
            <a
              className={styles.socialLink}
              href="https://www.instagram.com/julietoursphilly/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Julie on Instagram"
            >
              <img src="/icons/instagram.png" alt="Instagram" />
            </a>
            <a
              className={styles.socialLink}
              href="https://www.julietoursphilly.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Julie's website"
            >
              <img src="/icons/website.png" alt="Website" />
            </a>
          </div>
          {/* eslint-enable @next/next/no-img-element */}
        </div>
        <div className={styles.bellWrap}>
          <button
            className={styles.iconBtn}
            aria-label="Notifications"
            aria-expanded={bellOpen}
            onClick={toggleBell}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.iconImg} src="/icons/bell.png" alt="" />
            {notif.unread > 0 && (
              <span className={styles.bellBadge}>{notif.unread > 9 ? "9+" : notif.unread}</span>
            )}
          </button>
          {bellOpen && (
            <>
              {/* outside-click catcher */}
              <div className={styles.bellScrim} onClick={() => setBellOpen(false)} />
              <div className={styles.notifPanel}>
                <div className={styles.notifHead}>
                  <h3>Notifications</h3>
                  {notif.items.length > 0 && (
                    <button className={styles.notifClear} onClick={notif.clearAll}>
                      Clear all
                    </button>
                  )}
                  <button
                    className={styles.notifClose}
                    aria-label="Close notifications"
                    onClick={() => setBellOpen(false)}
                  >
                    ✕
                  </button>
                </div>
                {notif.items.length === 0 ? (
                  <p className={styles.notifEmpty}> No new notifications</p>
                ) : (
                  <div className={styles.notifList}>
                    {notif.items.map((n) => (
                      <div
                        key={n.id}
                        className={styles.notifRow}
                        onClick={() => {
                          notif.markAllRead();
                          setBellOpen(false);
                        }}
                      >
                        <div className={styles.notifTitle}>{n.title}</div>
                        {n.message && <div className={styles.notifMsg}>{n.message}</div>}
                        <div className={styles.notifTime}>{relTime(n.time)}</div>
                      </div>
                    ))}
                  </div>
                )}   
                 <div className={styles.notifFooter}>
                <PushSetup className={styles.pushInline} />
              </div>
              </div>             
            </>
          )}
        </div>
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
            <button className={styles.drawerLink} onClick={() => { setView("calendar"); setMenuOpen(false); }}>
              📆 My Calendar
            </button>
            <button className={styles.drawerLink} onClick={() => { setView("chat"); setMenuOpen(false); }}>
              💬 Family Chat
            </button>
            <button className={styles.drawerLink} onClick={() => { setView("events"); setMenuOpen(false); }}>
              ＋ Add / Manage Events
            </button>
            <a className={styles.drawerLink} href="/admin/crm">👥 Client CRM</a>
            <a className={styles.drawerLink} href="/admin/playbook">📖 Content Playbook</a>
            <a className={styles.drawerLink} href="/">🏙 View public site</a>
            <h4>About App</h4>
            <p>
              Julie&apos;s Dashboard surfaces upcoming events across Fairmount,
              Brewerytown and Spring Garden that are perfect for real-estate
              content. Events sync automatically every morning at 9am from
              Ticketmaster, Visit Philly, the City of Philadelphia and more.
            </p>
            <div className={styles.drawerFoot}>
              <button
                className={styles.signOutBtn}
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                👋 Sign out
              </button>
              <p className={styles.credits}>
                <a target="_blank" rel="noopener noreferrer" href="https://icons8.com/icon/pVlzUsxgdINd/camper">Camper</a>
                {" "}icon by{" "}
                <a target="_blank" rel="noopener noreferrer" href="https://icons8.com">Icons8</a>
                {" · "}
                Family Chat thumb icons by rukanicon, Magnific &amp; Md Tanvirul Haque —{" "}
                <a target="_blank" rel="noopener noreferrer" href="https://www.flaticon.com">Flaticon</a>
              </p>
            </div>
          </aside>
        </div>
      )}

      <EventAlerts onNewEvent={() => router.refresh()} onNotification={notif.add} />

      {view === "events" && consoleData && <AdminConsole data={consoleData} />}
      {view === "chat" && <AdminChat />}
      {view === "profile" && <ProfileView interactions={inter} act={act} />}
      {view === "calendar" && (
        <CalendarView
          interactions={inter}
          refresh={refreshInteractions}
          gcalConnected={gcalConnected}
          onGcalChange={refreshGcal}
          initialNotice={gcalNotice}
          editable
        />
      )}
      {view === "achievements" && <AchievementsView achievements={ach} />}

      {view === "dashboard" && (
        <>
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
              background: `conic-gradient(var(--purple) 0 ${IMPACT.progressPct}%, #ece4d4 ${IMPACT.progressPct}% 100%)`,
            }}
          >
            <div className={styles.levelRingInner}>
              <span className={styles.levelNum}>Level {IMPACT.level}</span>
              <span className={styles.levelName}>{IMPACT.levelName}</span>
              <span className={styles.levelTrophy}>🏆</span>
            </div>
          </div>
        </div>

        <div
          className={styles.streakCard}
          style={{
            backgroundImage: `linear-gradient(rgba(35,28,22,0.5), rgba(35,28,22,0.62)), url(${weeklyStreakImage()})`,
          }}
        >
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
        <button
          className={styles.chip}
          data-active={highOnly}
          onClick={() => setHighOnly((v) => !v)}
          title="Only show high-priority events (Fairmount / Brewerytown tier)"
        >
          🔴 High Priority
          <span className={styles.chipCount}>{highCount}</span>
        </button>
        {events.some((e) => attendedIds.has(e.id)) && (
          <button
            className={styles.chip}
            data-active={active === "__attended"}
            onClick={() => setActive(active === "__attended" ? "All" : "__attended")}
            title="Events you've attended"
          >
            ✓ Attended
            <span className={styles.chipCount}>
              {events.filter((e) => attendedIds.has(e.id)).length}
            </span>
          </button>
        )}
      </div>

      {/* date-range sub-filter + sort — second axis, ANDs with the chips above */}
      <div className={styles.subRow}>
        {RANGE_CHIPS.map((r) => (
          <button
            key={r.key}
            className={styles.subChip}
            data-active={range === r.key}
            onClick={() => setRange(r.key)}
          >
            {r.label}
            <span className={styles.subCount}>{rangeCounts[r.key]}</span>
          </button>
        ))}
        <select
          className={styles.sortSelect}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort events"
        >
          <option value="soonest">Soonest first</option>
          <option value="newest">Newest added</option>
        </select>
      </div>

      {/* ---------- 4a. happening now (started, still running) ---------- */}
      {active !== "__attended" && ongoing.length > 0 && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>🔵 Ongoing Events</h2>
            <span className={styles.pastCount}>{ongoing.length}</span>
          </div>
          <p className={styles.calBlurb}>Already running — end date is still ahead.</p>
          <div className={styles.scrollBox} data-kind="ongoing">
            <div className={styles.list}>
              {ongoing.map((ev) => (
                <EventCard key={ev.id} ev={ev} row={inter[ev.id]} act={act} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- 4b. upcoming events (fixed-height scroll box) ---------- */}
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.headIcon} src="/icons/events.png" alt="" />
            {active === "__attended" ? "Attended Events" : "Upcoming Events"}
          </h2>
          <button className={styles.seeAll} onClick={() => setView("calendar")}>
            See Calendar ›
          </button>
        </div>

        {upcoming.length === 0 ? (
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
              {upcoming.map((ev) => (
                <EventCard key={ev.id} ev={ev} row={inter[ev.id]} act={act} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---------- past events (collapsed below the main feed) ---------- */}
      {pastEvents.length > 0 && (
        <div className={styles.panel}>
          <button
            className={styles.pastToggle}
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
          >
            <h2>🕘 Past Events</h2>
            <span className={styles.pastCount}>{pastEvents.length}</span>
            <span className={styles.pastChev} data-open={showPast}>›</span>
          </button>
          {showPast && (
            <div className={styles.scrollBox} data-past="true">
              <div className={styles.list}>
                {pastEvents.map((ev) => (
                  <EventCard key={ev.id} ev={ev} row={inter[ev.id]} act={act} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
          <a
            className={styles.mapBtn}
            href="https://www.google.com/maps/search/?api=1&query=events+in+Fairmount+Philadelphia"
            target="_blank"
            rel="noopener noreferrer"
          >
            🔍 View Full Map <span aria-hidden="true">›</span>
          </a>
        </div>
      </section>

      {/* ---------- 6. achievements (live weekly engine) ---------- */}
      <div className={styles.achievePanel}>
        <div className={styles.panelHead}>
          <h2>🏆 Achievements</h2>
          <span className={styles.achieveNote}>This week</span>
          <button className={styles.seeAll} onClick={() => setView("achievements")}>
            View All ›
          </button>
        </div>
        <div className={styles.achieveRow}>
          {ACHIEVEMENT_DEFS.map((def) => {
            const row = (ach?.week || []).find((r) => r.key === def.key);
            const p = row?.progress || {};
            return (
              <div key={def.key} className={styles.achieveItem} data-locked={!row?.earned}>
                <span className={styles.achieveIcon}>{def.icon}</span>
                <span className={styles.achieveLabel}>{def.label}</span>
                <span className={styles.achieveSub}>
                  {row?.earned ? "Earned!" : `${p.count ?? 0}/${p.target ?? 1}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}

      {/* ---------- 7. bottom navigation ---------- */}
      <nav className={styles.bottomNav}>
        {/* eslint-disable @next/next/no-img-element */}
        <button
          className={styles.navItem}
          data-active={view === "dashboard"}
          onClick={() => setView("dashboard")}
        >
          <span><img className={styles.navImg} src="/icons/home.png" alt="" /></span>Dashboard
        </button>
        <button
          className={styles.navItem}
          data-active={view === "chat"}
          onClick={() => setView("chat")}
        >
          <span><img className={styles.navImg} src="/icons/bell.png" alt="" /></span>Family Chat
        </button>
        <button
          className={styles.navAdd}
          aria-label="Add Event"
          onClick={() => setView("events")}
          title="Create and manage events"
        >
          <span className={styles.navAddCircle}>＋</span>
          <em>Add Event</em>
        </button>
        <button
          className={styles.navItem}
          data-active={view === "achievements"}
          onClick={() => setView("achievements")}
        >
          <span><img className={styles.navImg} src="/icons/achievements.png" alt="" /></span>Badges
        </button>
        <button
          className={styles.navItem}
          data-active={view === "profile"}
          onClick={() => setView("profile")}
        >
          <span><img className={styles.navImg} src="/icons/profile.png" alt="" /></span>Profile
        </button>
        {/* eslint-enable @next/next/no-img-element */}
      </nav>
    </div>
  );
}
