// One-off repair: the n8n node wrote clients directly to Postgres with a broken
// mapping — clientType got the ENTIRE raw row JSON (not "RENTER"), and Julie's
// "Notes" column was concatenated with the client's own free-text. This
// re-cleans every client from its stored rawSource through the canonical
// cleanFormRow(), refreshing sheet-owned fields while PRESERVING Julie's
// workflow state (stage, pins, follow-ups, tags, and the original createdAt /
// lastReachedOut she's been working from).
//
//   node scripts/repairClients.js
require("dotenv").config();
const { Client } = require("pg");
const { cleanFormRow } = require("../lib/crm");

(async () => {
  const c = new Client({ connectionString: process.env.DIRECT_URL });
  await c.connect();

  const { rows } = await c.query(
    'SELECT id, "clientType", notes, "createdAt", "lastReachedOut", "emailIsReal", "rawSource" FROM "Client" WHERE "rawSource" IS NOT NULL'
  );
  console.log(`repairing ${rows.length} clients…`);

  let fixed = 0, notesAdded = 0, skipped = 0;
  for (const row of rows) {
    const clean = cleanFormRow(row.rawSource);
    if (!clean) { skipped++; continue; }

    // sheet-owned fields refreshed from the canonical cleaner
    await c.query(
      `UPDATE "Client" SET
         name=$1, email=$2, partners=$3, "clientType"=$4, source=$5,
         neighborhoods=$6, "moveMonth"=$7, "creditBand"=$8, "proofOfIncome"=$9,
         "whoLiving"=$10, "outOfState"=$11, notes=$12, "specificProperty"=$13,
         "maxRent"=$14, "bedroomsMin"=$15, "bedroomsRaw"=$16, pets=$17,
         "takingOn"=$18, "contactedRaw"=$19, "emailIsReal"=$20,
         "lastReachedOut"=$21, "createdAt"=$22
       WHERE id=$23`,
      [
        clean.name, clean.email, clean.partners, clean.clientType, clean.source,
        clean.neighborhoods, clean.moveMonth, clean.creditBand, clean.proofOfIncome,
        clean.whoLiving, clean.outOfState, clean.notes, clean.specificProperty,
        clean.maxRent, clean.bedroomsMin, clean.bedroomsRaw, clean.pets,
        clean.takingOn, clean.contactedRaw,
        // preserve a verified email flag Julie may have set
        row.emailIsReal || clean.emailIsReal,
        // preserve existing workflow timestamps; fall back to the cleaned value
        row.lastReachedOut || clean.lastReachedOut || null,
        row.createdAt || clean.createdAt || new Date(),
        row.id,
      ]
    );
    fixed++;

    // the client's own free-text ("Anything else important to note?") belongs
    // in a ClientNote, distinct from Julie's "Notes" column — add if missing
    if (clean.intakeNote) {
      const body = `From the form: ${clean.intakeNote}`;
      const exists = await c.query(
        'SELECT 1 FROM "ClientNote" WHERE "clientId"=$1 AND body=$2 LIMIT 1',
        [row.id, body]
      );
      if (exists.rowCount === 0) {
        const noteId = "cn" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
        await c.query(
          'INSERT INTO "ClientNote" (id, "clientId", body, reminded, "createdAt") VALUES ($1,$2,$3,false,$4)',
          [noteId, row.id, body, row.createdAt || clean.createdAt || new Date()]
        );
        notesAdded++;
      }
    }
  }

  console.log(`done: fixed=${fixed} intakeNotesAdded=${notesAdded} skipped=${skipped}`);

  // sanity: clientType distribution should now be RENTER/BUYER only
  const dist = await c.query('SELECT "clientType", count(*) FROM "Client" GROUP BY "clientType"');
  console.log("clientType distribution:", JSON.stringify(dist.rows));
  await c.end();
})().catch((e) => { console.error("REPAIR FAILED:", e.message); process.exit(1); });
