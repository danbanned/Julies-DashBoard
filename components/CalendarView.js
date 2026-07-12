"use client";

import { useMemo, useState } from "react";
import styles from "../app/Events.module.css";

// Julie's in-app planning calendar (8g): events she added via 📅 live here
// until she pushes them to Google Calendar (8e). Simple month grid — clean,
// not gamey.
export default function CalendarView({
  interactions,
  refresh,
  gcalConnected = false,
  onGcalChange,
  initialNotice = "",
}) {
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(initialNotice);

  const planned = useMemo(
    () =>
      Object.values(interactions)
        .filter((r) => r.addedToCalendar && r.eventStartDate)
        .sort((a, b) => a.eventStartDate.localeCompare(b.eventStartDate)),
    [interactions]
  );

  const byDate = useMemo(() => {
    const m = {};
    for (const r of planned) (m[r.eventStartDate] ||= []).push(r);
    return m;
  }, [planned]);

  const y = month.getFullYear();
  const mo = month.getMonth();
  const monthLabel = month.toLocaleString("en-US", { month: "long", year: "numeric" });
  const first = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday-first offset
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const iso = (d) => `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const monthPlanned = planned.filter((r) => r.eventStartDate.startsWith(`${y}-${String(mo + 1).padStart(2, "0")}`));

  async function pushToGoogle(r) {
    // Not connected yet → run the in-app OAuth flow; the callback finishes
    // this exact add (eventId travels in the OAuth `state`).
    if (!gcalConnected) {
      window.location.href = `/api/auth/google?eventId=${encodeURIComponent(r.eventId)}`;
      return;
    }
    setBusyId(r.eventId);
    setNotice("");
    try {
      const res = await fetch("/api/calendar/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: r.eventId }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice(`✅ "${r.eventTitle}" is on your Google Calendar.`);
        refresh();
      } else if (res.status === 401 && data.reconnect) {
        // token revoked/expired — go straight back through consent
        onGcalChange?.();
        window.location.href = `/api/auth/google?eventId=${encodeURIComponent(r.eventId)}`;
        return;
      } else {
        setNotice(`Couldn't sync: ${data.error || res.status}`);
      }
    } catch {
      setNotice("Couldn't reach the sync service.");
    }
    setBusyId(null);
  }

  async function disconnect() {
    await fetch("/api/auth/google/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect" }),
    }).catch(() => {});
    setNotice("Google Calendar disconnected.");
    onGcalChange?.();
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2>📆 My Calendar</h2>
      </div>
      <p className={styles.calBlurb}>
        Events you plan with 📅 land here first. Push them to Google Calendar when you&apos;re ready.
      </p>

      <div className={styles.gcalRow}>
        {gcalConnected ? (
          <>
            <span className={styles.gcalStatus} data-on="true">Google Calendar: Connected ✓</span>
            <button className={styles.gcalLink} onClick={disconnect}>Disconnect</button>
          </>
        ) : (
          <>
            <span className={styles.gcalStatus}>Google Calendar: not connected</span>
            <a className={styles.gcalLink} href="/api/auth/google">Connect</a>
          </>
        )}
      </div>

      <div className={styles.calNav}>
        <button className={styles.calNavBtn} onClick={() => setMonth(new Date(y, mo - 1, 1))}>‹</button>
        <span className={styles.calMonth}>{monthLabel}</span>
        <button className={styles.calNavBtn} onClick={() => setMonth(new Date(y, mo + 1, 1))}>›</button>
      </div>

      <div className={styles.calGrid}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className={styles.calDow}>{d}</span>
        ))}
        {cells.map((d, i) =>
          d === null ? (
            <span key={`x${i}`} />
          ) : (
            <div key={d} className={styles.calCell} data-has={Boolean(byDate[iso(d)])}>
              <span className={styles.calDay}>{d}</span>
              {(byDate[iso(d)] || []).slice(0, 2).map((r) => (
                <span key={r.eventId} className={styles.calChip} title={r.eventTitle}>
                  {r.eventTitle}
                </span>
              ))}
              {(byDate[iso(d)] || []).length > 2 && (
                <span className={styles.calMore}>+{byDate[iso(d)].length - 2}</span>
              )}
            </div>
          )
        )}
      </div>

      {notice && <p className={styles.calNotice}>{notice}</p>}

      <div className={styles.savedList}>
        {monthPlanned.length === 0 ? (
          <div className={styles.empty}>
            <h3>Nothing planned this month</h3>
            <p>Tap 📅 on an event card to add it to your calendar.</p>
          </div>
        ) : (
          monthPlanned.map((r) => (
            <div key={r.eventId} className={styles.savedRow}>
              <div className={styles.savedInfo}>
                <div className={styles.savedTitle}>{r.eventTitle}</div>
                <div className={styles.savedMeta}>
                  {[r.eventStartDate, r.location || r.neighborhood].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className={styles.savedActions}>
                {r.calendarEventId ? (
                  <span className={styles.syncedTag}>✓ Synced</span>
                ) : (
                  <button
                    className={styles.syncBtn}
                    disabled={busyId === r.eventId}
                    onClick={() => pushToGoogle(r)}
                  >
                    {busyId === r.eventId
                      ? "Syncing…"
                      : gcalConnected
                        ? "Push to Google"
                        : "Connect & add"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
