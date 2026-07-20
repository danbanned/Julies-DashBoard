// Seed the Content Playbook (15f) from Julie's real Notion export.
// Parses the CLEAN section pages the hub links to (skips the earlier-draft
// duplicates), maps them into pillars/sections/blocks/callouts, and links the
// images already copied to /public/playbook. Idempotent: clears the four
// playbook tables and re-imports.
//
//   node scripts/seedPlaybook.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const SRC = "C:/Users/idont/Downloads/playbook_content_extracted/playbook_content";

// pillars (+ Getting Started grouping). Inspiration tab is a view filter.
const PILLARS = [
  { key: "lifestyle", name: "Lifestyle", emoji: "🏡", order: 0 },
  { key: "food", name: "Food", emoji: "☕", order: 1 },
  { key: "nature", name: "Nature", emoji: "🌳", order: 2 },
  { key: "community", name: "Community", emoji: "📍", order: 3 },
  { key: "getting_started", name: "Getting Started", emoji: "📖", order: 4 },
];

// CLEAN pages only (the hub's live links). Drafts intentionally excluded.
const SECTIONS = [
  { file: "Lifestyle First & House Tours 39714aaddf1e81de83e2ce91507c6a0b.md", pillar: "lifestyle" },
  { file: "Reel Frameworks & Covers 39714aaddf1e814a9d62d98c72ca7f5b.md", pillar: "lifestyle" },
  { file: "Food, Coffee & Local Businesses 39714aaddf1e813b9176edc968254e31.md", pillar: "food" },
  { file: "Parks, Dogs & Bikes — Outdoor Living 39714aaddf1e81278bb5fff353fe7f79.md", pillar: "nature" },
  { file: "Tour Yourself — The Walking Loop 39714aaddf1e811492efe9fc1f42f4c0.md", pillar: "nature" },
  { file: "History & Hidden Gems 39714aaddf1e81688fdac0a0aefcc9e3.md", pillar: "community" },
  { file: "Events Calendar — Confirmed Upcoming (as of July 8 39714aaddf1e8168ba08f03ee5f8edc6.md", pillar: "community" },
  { file: "Start Here — Content Philosophy 39714aaddf1e81d0868fcf530b567b8d.md", pillar: "getting_started" },
  { file: "Weekly Content Planner 39714aaddf1e81fcafb6cda0a3d2fef5.md", pillar: "getting_started" },
];

const CALLOUT_TYPE = {
  "💡": "CONTENT_IDEA",
  "🎥": "REEL_IDEA",
  "📍": "SHOOT_HERE",
  "📈": "WHY_IT_WORKS",
  "⚠️": "DONT_DO_THIS",
  "⭐": "PRO_TIP",
};
const CALLOUT_LEAD = /^>\s*(💡|🎥|📍|📈|⚠️|⭐)\s*\*\*([^:]+):\*\*\s*(.*)$/;
const HEADING = /^##\s+(\p{Emoji_Presentation}|\p{Extended_Pictographic})?\s*(.+)$/u;
const IMG = /!\[[^\]]*\]\(([^)]+)\)/;

function imgBasename(pathStr) {
  try {
    return decodeURIComponent(pathStr).split("/").pop();
  } catch {
    return pathStr.split("/").pop();
  }
}

// Parse a section page, PRESERVING newlines in block bodies so GFM tables and
// ordered/bulleted lists survive intact (Phase 16c — the old parser collapsed
// everything to a single line, which broke every table and numbered list).
function parseSection(md) {
  const lines = md.split(/\r?\n/);
  let title = null;
  let subtitle = null;
  let coverImage = null;
  const blocks = [];
  let cur = null; // current block
  let sawHeading = false;

  const pushBody = (text) => { if (cur) cur.bodyLines.push(text); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const raw = line.trim();

    // blank line → paragraph break WITHIN a block (needed for GFM to separate
    // a lead paragraph from a following table/list)
    if (!raw) {
      if (cur && cur.bodyLines.length) pushBody("");
      continue;
    }

    if (!title && raw.startsWith("# ")) {
      title = raw.replace(/^#\s+/, "").trim();
      continue;
    }
    if (/^Owner:/i.test(raw)) continue;
    if (raw === "---") continue;

    // callouts (blockquote leads with a typed emoji)
    const cm = raw.match(CALLOUT_LEAD);
    if (cm && cur) {
      cur.callouts.push({ type: CALLOUT_TYPE[cm[1]] || "NOTE", text: `${cm[2].trim()}: ${cm[3].trim()}`.trim() });
      continue;
    }

    // heading → new block
    const hm = line.match(HEADING);
    if (hm) {
      sawHeading = true;
      cur = { emoji: (hm[1] || "").trim() || null, heading: hm[2].trim(), bodyLines: [], callouts: [] };
      blocks.push(cur);
      continue;
    }

    // images
    const im = raw.match(IMG);
    if (im) {
      const base = imgBasename(im[1]);
      const url = `/playbook/${base}`;
      if (!sawHeading && !coverImage) coverImage = url;
      continue;
    }

    // blockquote subtitle before first heading
    if (!sawHeading && raw.startsWith(">")) {
      const q = raw.replace(/^>\s*/, "").replace(/\*\*/g, "").replace(/^["“]|["”]$/g, "").trim();
      if (q && !q.startsWith("—") && !subtitle) subtitle = q;
      continue;
    }

    // toggle → bold label + preserved bullet sub-list (renders as a real list)
    if (/^-\s*▼/.test(raw) && cur) {
      const label = raw.replace(/^-\s*▼\s*/, "").trim();
      if (cur.bodyLines.length) pushBody("");
      pushBody(`**${label}**`);
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        pushBody(`- ${lines[j].replace(/^\s+-\s+/, "").trim()}`);
        j++;
      }
      i = j - 1;
      continue;
    }

    // any other blockquote inside a block (rare captions) — skip
    if (raw.startsWith(">")) continue;

    // body line (paragraph, list item, or table row) — preserved verbatim
    if (cur) pushBody(line.replace(/\s+$/, ""));
  }

  // finalize: join with newlines, collapse triple+ blanks, trim
  for (const b of blocks) {
    b.body = b.bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim() || null;
    delete b.bodyLines;
  }

  return { title, subtitle, coverImage, blocks };
}

(async () => {
  const c = new Client({ connectionString: process.env.DIRECT_URL });
  await c.connect();

  // clear (children first)
  await c.query('DELETE FROM "PlaybookCallout"');
  await c.query('DELETE FROM "PlaybookBlock"');
  await c.query('DELETE FROM "PlaybookSection"');
  await c.query('DELETE FROM "PlaybookPillar"');

  const cuid = () => "pb" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
  const pillarId = {};
  for (const p of PILLARS) {
    const id = cuid();
    pillarId[p.key] = id;
    await c.query('INSERT INTO "PlaybookPillar" (id, key, name, emoji, "order") VALUES ($1,$2,$3,$4,$5)', [id, p.key, p.name, p.emoji, p.order]);
  }

  let secN = 0, blockN = 0, calloutN = 0;
  const perPillar = {};
  for (let s = 0; s < SECTIONS.length; s++) {
    const conf = SECTIONS[s];
    const md = fs.readFileSync(path.join(SRC, conf.file), "utf8");
    const parsed = parseSection(md);
    if (!parsed.title) continue;
    const sid = cuid();
    await c.query(
      'INSERT INTO "PlaybookSection" (id, "pillarId", title, subtitle, "coverImage", neighborhoods, "order") VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [sid, pillarId[conf.pillar], parsed.title, parsed.subtitle, parsed.coverImage, ["Fairmount", "Brewerytown"], s]
    );
    secN++;
    for (let b = 0; b < parsed.blocks.length; b++) {
      const blk = parsed.blocks[b];
      const bid = cuid();
      await c.query(
        'INSERT INTO "PlaybookBlock" (id, "sectionId", emoji, heading, body, "order") VALUES ($1,$2,$3,$4,$5,$6)',
        [bid, sid, blk.emoji, blk.heading, blk.body || null, b]
      );
      blockN++;
      for (let k = 0; k < blk.callouts.length; k++) {
        const co = blk.callouts[k];
        await c.query(
          'INSERT INTO "PlaybookCallout" (id, "blockId", type, text, "order") VALUES ($1,$2,$3,$4,$5)',
          [cuid(), bid, co.type, co.text, k]
        );
        calloutN++;
        perPillar[conf.pillar] = (perPillar[conf.pillar] || 0) + 1;
      }
    }
  }

  console.log(`seeded: ${PILLARS.length} pillars, ${secN} sections, ${blockN} blocks, ${calloutN} callouts`);
  console.log("callouts per pillar:", JSON.stringify(perPillar));
  await c.end();
})().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });
