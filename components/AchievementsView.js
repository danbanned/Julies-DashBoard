"use client";

import styles from "../app/Events.module.css";
import { ACHIEVEMENT_DEFS } from "../lib/achievementDefs";

function weekLabel(weekStart) {
  const [y, m, d] = weekStart.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `Week of ${dt.toLocaleString("en-US", { month: "short", day: "numeric" })}`;
}

// Achievement history (8i) — a calm, habit-tracker-style weekly view.
// No XP, no levels, no points: just what was earned each week.
export default function AchievementsView({ achievements }) {
  const week = achievements?.week || [];
  const history = achievements?.history || [];
  const byKey = Object.fromEntries(week.map((r) => [r.key, r]));

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2>🏆 This Week</h2>
        <span className={styles.achieveNote}>Resets every Monday</span>
      </div>

      <div className={styles.weekList}>
        {ACHIEVEMENT_DEFS.map((def) => {
          const row = byKey[def.key];
          const p = row?.progress || {};
          const count = p.count ?? 0;
          const target = p.target ?? 1;
          return (
            <div key={def.key} className={styles.weekRow} data-earned={Boolean(row?.earned)}>
              <span className={styles.weekIcon}>{def.icon}</span>
              <div className={styles.weekInfo}>
                <div className={styles.weekLabel}>{def.label}</div>
                <div className={styles.weekDesc}>{def.desc}</div>
                <div className={styles.weekTrack}>
                  <div
                    className={styles.weekFill}
                    style={{ width: `${Math.min(100, (count / target) * 100)}%` }}
                  />
                </div>
              </div>
              <span className={styles.weekStatus}>
                {row?.earned ? "✓" : `${count}/${target}`}
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.panelHead} style={{ marginTop: 18 }}>
        <h2>📖 Past Weeks</h2>
      </div>
      {history.length === 0 ? (
        <div className={styles.empty}>
          <h3>No history yet</h3>
          <p>Each week&apos;s results are saved here automatically when the new week starts.</p>
        </div>
      ) : (
        <div className={styles.historyList}>
          {history.map((h) => {
            const earned = h.items.filter((i) => i.earned);
            return (
              <div key={h.weekStart} className={styles.historyRow}>
                <span className={styles.historyWeek}>{weekLabel(h.weekStart)}</span>
                <span className={styles.historyBadges}>
                  {earned.length === 0
                    ? "—"
                    : earned.map((i) => {
                        const def = ACHIEVEMENT_DEFS.find((d) => d.key === i.key);
                        return (
                          <span key={i.key} title={def?.label}>
                            {def?.icon}
                          </span>
                        );
                      })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
