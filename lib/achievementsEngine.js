// Weekly achievement engine (server-only, 8h).
// All achievements track within a Monday–Sunday week. Each week's state is
// its own Achievement row (unique on userId+key+weekStart), so past weeks
// are automatically archived and the new week starts from zero — reset and
// history fall out of the data model, no cron needed.
import { prisma } from "./db";
import { mondayOf } from "./achievementDefs";

const CORE_HOODS = ["Fairmount", "Brewerytown", "Spring Garden"];

// Recompute the current week's four achievements from raw interactions and
// upsert their rows. Returns the fresh rows (used by the UI after actions).
export async function recomputeCurrentWeek(userId) {
  const weekStart = mondayOf();
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const inWeek = (d) => d && d >= start && d < end;

  const rows = await prisma.eventInteraction.findMany({ where: { userId } });

  const attended = rows.filter((r) => r.attended && inWeek(r.attendedAt));
  const shared = rows.filter((r) => r.shared && inWeek(r.sharedAt));
  const viewsOnShared = shared.reduce((sum, r) => sum + r.views, 0);
  const posted = rows.filter((r) => r.posted && inWeek(r.postedAt));
  const hoods = new Set(attended.map((r) => r.neighborhood).filter(Boolean));

  const results = {
    event_explorer: {
      earned: attended.length >= 3,
      progress: { count: Math.min(attended.length, 3), target: 3 },
    },
    community_spotlight: {
      earned: shared.length >= 3 && viewsOnShared >= 3,
      progress: {
        shared: shared.length,
        views: viewsOnShared,
        target: 3,
        count: Math.min(shared.length, 3),
      },
    },
    content_creator: {
      earned: posted.length >= 1,
      progress: { count: Math.min(posted.length, 1), target: 1 },
    },
    neighborhood_expert: {
      earned: CORE_HOODS.every((h) => hoods.has(h)),
      progress: {
        hoods: CORE_HOODS.filter((h) => hoods.has(h)),
        count: CORE_HOODS.filter((h) => hoods.has(h)).length,
        target: CORE_HOODS.length,
      },
    },
  };

  const out = [];
  for (const [key, r] of Object.entries(results)) {
    const existing = await prisma.achievement.findUnique({
      where: { userId_key_weekStart: { userId, key, weekStart } },
    });
    const earnedAt = r.earned ? existing?.earnedAt || new Date() : null;
    out.push(
      await prisma.achievement.upsert({
        where: { userId_key_weekStart: { userId, key, weekStart } },
        update: { earned: r.earned, earnedAt, progress: r.progress },
        create: { userId, key, weekStart, earned: r.earned, earnedAt, progress: r.progress },
      })
    );
  }
  return out;
}

// Current week's rows + full history grouped by week (newest first).
export async function getAchievementState(userId) {
  const weekStart = mondayOf();
  let week = await prisma.achievement.findMany({ where: { userId, weekStart } });
  if (week.length === 0) week = await recomputeCurrentWeek(userId);

  const past = await prisma.achievement.findMany({
    where: { userId, weekStart: { not: weekStart } },
    orderBy: { weekStart: "desc" },
  });
  const history = [];
  for (const row of past) {
    let bucket = history.find((h) => h.weekStart === row.weekStart);
    if (!bucket) history.push((bucket = { weekStart: row.weekStart, items: [] }));
    bucket.items.push(row);
  }
  return { weekStart, week, history };
}
