// ============================================================================
// stats.js — the ONE place gamification numbers come from (Phase 6 rule).
// ----------------------------------------------------------------------------
// No analytics / activity-tracking source exists yet, so every getter returns
// an honest zero/empty starting state. When a real source lands (Google
// Sheets aggregate, activity log, Phase 5 notifications), wire it up HERE —
// the components never change.
// ============================================================================

// 6a. "Your Impact" — Julie hasn't started sharing events or gaining views.
export function getImpactStats() {
  return {
    eventsShared: 0,
    profileViews: 0,
    level: 1,
    levelName: "Getting Started",
    // 0–100; drives the ring and the progress bar
    progressPct: 0,
    nextLevelCopy: "Share your first event to start leveling up",
  };
}

// 6b. Daily Streak — driven by a recorded-activity log (empty for now).
// Returns the current week (Mon–Sun) with each day marked done from the log.
export function getStreakData() {
  const activityLog = []; // "YYYY-MM-DD" dates of recorded activity — none yet

  const done = new Set(activityLog);
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // back to Monday

  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    week.push({
      d: d.toLocaleString("en-US", { weekday: "narrow" }),
      done: done.has(iso),
    });
  }

  return { days: 0, week };
}

// 6c. Notifications — unread new-event notifications (Phase 5). None wired
// yet, so the bell renders with no badge.
export function getNotifications() {
  return [];
}

// 6e. Achievements — all locked until real progress tracking exists.
// `unlocked` flips per-badge once criteria are actually met.
export function getAchievements() {
  return [
    { icon: "📅", label: "Event Explorer", unlocked: false },
    { icon: "📣", label: "Community Spotlight", unlocked: false },
    { icon: "📸", label: "Content Creator", unlocked: false },
    { icon: "⭐", label: "Neighborhood Expert", unlocked: false },
    { icon: "🔒", label: "Philly Legend", unlocked: false, note: "(Coming Soon)" },
  ];
}
