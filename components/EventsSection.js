"use client";

import { useMemo, useState } from "react";
import styles from "../app/Events.module.css";

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
    <Wrapper className={styles.card} {...wrapperProps}>
      <div className={styles.thumb}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ev.image_url} alt="" loading="lazy" />
        <span className={styles.badge} data-p={ev.priority}>
          {ev.priority} priority
        </span>
        {ev.new_since_last && <span className={styles.newDot}>NEW</span>}
      </div>
      <div className={styles.body}>
        <div className={styles.dateRow}>
          <span>{mo} {day}</span>
          <span>· {dow}</span>
        </div>
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
    </Wrapper>
  );
}

export default function EventsSection({ events, chips }) {
  const [active, setActive] = useState("All");

  const filtered = useMemo(() => {
    if (active === "All") return events;
    return events.filter((e) => e.neighborhood === active);
  }, [active, events]);

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const e of filtered) c[e.priority]++;
    return c;
  }, [filtered]);

  return (
    <div className={styles.shell}>
      <div className={styles.hello}>
        <h1>Hi Julie! 👋</h1>
        <p>New events. New opportunities.</p>
      </div>

      {/* filter chips — auto-generated from real neighborhoods */}
      <div className={styles.chips}>
        <button
          className={styles.chip}
          data-active={active === "All"}
          onClick={() => setActive("All")}
        >
          📍 All Areas
          <span className={styles.chipCount}>{events.length}</span>
        </button>
        {chips.map((c) => (
          <button
            key={c.name}
            className={styles.chip}
            data-active={active === c.name}
            onClick={() => setActive(c.name)}
          >
            {c.name}
            <span className={styles.chipCount}>{c.count}</span>
          </button>
        ))}
      </div>

      {/* upcoming events */}
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>⭐ Upcoming Events</h2>
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
          <div className={styles.list}>
            {filtered.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        )}
      </div>

      {/* priority overview */}
      {filtered.length > 0 && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>🎯 Priority Overview</h2>
          </div>
          <div className={styles.overview}>
            <div className={styles.ovRow}>
              <span className={styles.ovLabel}>🔴 High Priority</span>
              <span className={styles.ovCount}>{counts.high}</span>
            </div>
            <div className={styles.ovRow}>
              <span className={styles.ovLabel}>🟠 Medium Priority</span>
              <span className={styles.ovCount}>{counts.medium}</span>
            </div>
            <div className={styles.ovRow}>
              <span className={styles.ovLabel}>🟢 Low Priority</span>
              <span className={styles.ovCount}>{counts.low}</span>
            </div>
            <div className={styles.ovRow}>
              <span className={styles.ovLabel}>Total Upcoming</span>
              <span className={styles.ovTotal}>{filtered.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
