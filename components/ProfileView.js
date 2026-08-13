"use client";

import styles from "../app/Events.module.css";
import FeaturedHero from "./FeaturedHero";

// Profile (8f) — for now one tab: Saved Events, read from the DB via the
// interactions map. Rows render from the DB snapshot so they still work
// after an event ages out of the feed.
export default function ProfileView({ interactions, act }) {
  const saved = Object.values(interactions)
    .filter((r) => r.saved)
    .sort((a, b) => String(a.eventStartDate || "").localeCompare(String(b.eventStartDate || "")));

  return (
    <>
    <FeaturedHero title="👤 Profile" subtitle="Your saved events, all in one place." />
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2>👤 Profile</h2>
        <a className={styles.gcalLink} href="/settings">⚙️ Settings</a>
      </div>
      <div className={styles.profileTabs}>
        <span className={styles.profileTab} data-active="true">🔖 Saved Events</span>
      </div>

      {saved.length === 0 ? (
        <div className={styles.empty}>
          <h3>Nothing saved yet</h3>
          <p>Tap the 🔖 icon on any event card to keep it here for later.</p>
        </div>
      ) : (
        <div className={styles.savedList}>
          {saved.map((r) => (
            <div key={r.eventId} className={styles.savedRow}>
              <div className={styles.savedInfo}>
                <div className={styles.savedTitle}>
                  {r.eventUrl ? (
                    <a href={r.eventUrl} target="_blank" rel="noopener noreferrer">
                      {r.eventTitle}
                    </a>
                  ) : (
                    r.eventTitle
                  )}
                </div>
                <div className={styles.savedMeta}>
                  {[r.eventStartDate, r.location || r.neighborhood].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className={styles.savedActions}>
                <button
                  className={styles.actBtn}
                  data-on={r.addedToCalendar}
                  title={r.addedToCalendar ? "Remove from calendar" : "Add to calendar"}
                  onClick={() => act({ id: r.eventId }, "calendar", !r.addedToCalendar)}
                >
                  📅
                </button>
                <button
                  className={styles.actBtn}
                  data-on="true"
                  title="Un-save"
                  onClick={() => act({ id: r.eventId }, "saved", false)}
                >
                  🔖
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
