// Reseed the database after a reset: Julie's admin account, content ideas,
// and a little demo data so the app is immediately usable.
//   node scripts/seed.js
// Idempotent — safe to run repeatedly. Events themselves come from the JSON
// feed in /data and never need seeding.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Client } = require("pg");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "julie@julietoursphilly.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "julie-philly-2026";

const IDEAS = [
  ["dog-lovers", "Where I’d live if I had a dog", "Pet-friendly events, dog socials, and more.", "🐾", 0],
  ["parks-outdoors", "Where I’d live if I loved parks", "Outdoor vibes, green spaces, and community.", "🌳", 1],
  ["couples-date-spots", "Couples Week / Date Spots", "Romantic, fun, and unique date night ideas.", "🍷", 2],
  ["hidden-history", "Hidden History", "Philly stories most people walk right past.", "🏛️", 3],
  ["foodie-finds", "Foodie Finds", "Markets, pop-ups, and neighborhood eats.", "🍜", 4],
  ["neighborhood-gems", "Neighborhood Gems", "Small local spots worth a visit.", "💎", 5],
  ["tour-yourself", "Tour Yourself Itinerary", "Self-guided walks through the neighborhoods.", "🚶‍♀️", 6],
];

(async () => {
  const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await c.connect();

  // 1. Julie — the single ADMIN. Fixed id "julie" so all her data reattaches.
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  await c.query(
    `INSERT INTO "User" (id, name, email, "passwordHash", role)
     VALUES ('julie', 'Julie', $1, $2, 'ADMIN')
     ON CONFLICT (id) DO UPDATE SET email=$1, "passwordHash"=$2, role='ADMIN', name='Julie'`,
    [ADMIN_EMAIL, hash]
  );

  // 2. Content ideas (Phase 12g).
  for (const [key, title, blurb, emoji, ord] of IDEAS) {
    await c.query(
      `INSERT INTO "ContentIdea" (key, title, blurb, emoji, "sortOrder")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (key) DO UPDATE SET title=$2, blurb=$3, emoji=$4, "sortOrder"=$5`,
      [key, title, blurb, emoji, ord]
    );
  }

  // 3. A welcome post so the Family Group Chat isn't empty.
  const existing = await c.query(`SELECT count(*) FROM "Post"`);
  if (Number(existing.rows[0].count) === 0) {
    await c.query(
      `INSERT INTO "Post" (id, "authorId", title, caption)
       VALUES ('seed-welcome', 'julie', 'Welcome to the family! 🤍',
       'This is where I''ll share updates, favorite finds, and what''s coming up around Fairmount & Brewerytown.')
       ON CONFLICT (id) DO NOTHING`
    );
  }

  const users = await c.query(`SELECT id, email, role FROM "User" ORDER BY "createdAt"`);
  const ideas = await c.query(`SELECT count(*) FROM "ContentIdea"`);
  console.log("users:", JSON.stringify(users.rows));
  console.log("content ideas:", ideas.rows[0].count, "| admin login:", ADMIN_EMAIL, "/", ADMIN_PASSWORD);
  await c.end();
})().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
