// CRM domain logic (Phase 14) — cleaning, stages, credit wording,
// actionability. ADMIN-ONLY data; nothing here is ever exposed publicly.
//
// n8n is the cleanup crew for the Sheets → app pipeline, but the SAME rules
// live here so /api/crm/sync is robust to raw-ish rows and the logic is
// testable in one place.

// ---------------------------------------------------------------------------
// Stages per client type (14d)
// ---------------------------------------------------------------------------
export const RENTER_STAGES = ["NEW", "CONTACTED", "SHOWING", "APPLICATION", "LEASE_SIGNED"];
export const BUYER_STAGES = [
  "NO_CONTRACT",
  "OFFER",
  "UNDER_CONTRACT",
  "INSPECTION",
  "FINANCING",
  "CLOSING_SCHEDULED",
  "CLOSED",
];
export const STAGE_LABELS = {
  NEW: "New",
  CONTACTED: "Contacted",
  SHOWING: "Showing",
  APPLICATION: "Application",
  LEASE_SIGNED: "Lease signed",
  NO_CONTRACT: "No contract",
  OFFER: "Offer submitted",
  UNDER_CONTRACT: "Under contract",
  INSPECTION: "Inspection",
  FINANCING: "Financing",
  CLOSING_SCHEDULED: "Closing scheduled",
  CLOSED: "Closed",
};
export function stagesFor(clientType) {
  return clientType === "BUYER" ? BUYER_STAGES : RENTER_STAGES;
}

// Buyer stages that count as an active contract
export const ACTIVE_CONTRACT_STAGES = ["UNDER_CONTRACT", "INSPECTION", "FINANCING", "CLOSING_SCHEDULED"];

// ---------------------------------------------------------------------------
// Credit bands — ALWAYS worded, never a raw number (guardrail 2)
// ---------------------------------------------------------------------------
export const CREDIT_BANDS = {
  "Under 650": "UNDER_650",
  "650-699": "B650_699",
  "700-749": "B700_749",
  "750+": "B750_PLUS",
};
export const CREDIT_WORDING = {
  UNDER_650: "Needs improvement",
  B650_699: "Fair",
  B700_749: "Good",
  B750_PLUS: "Excellent",
  UNKNOWN: "—",
};

// ---------------------------------------------------------------------------
// Field cleaners (verified against the real sheet)
// ---------------------------------------------------------------------------

// "Jonathan Cordon " / "alexandria eley" → clean, Title Case when all-lower
export function cleanName(raw) {
  const name = String(raw || "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  if (name === name.toLowerCase()) {
    return name.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name;
}

// Real values seen: 5.0, 3, "3-4", "3+", "Any", "3 or more. 2 full bath.",
// "<=2", "2-3" → minimum integer where possible, raw always kept.
export function parseBedrooms(raw) {
  const s = String(raw ?? "").trim();
  if (!s || /^any$/i.test(s)) return { bedroomsMin: null, bedroomsRaw: s || null };
  const le = s.match(/<=\s*(\d+)/);
  if (le) return { bedroomsMin: parseInt(le[1], 10), bedroomsRaw: s };
  const m = s.match(/(\d+)/);
  return { bedroomsMin: m ? parseInt(m[1], 10) : null, bedroomsRaw: s };
}

// "Fairmount, Brewerytown, Spring Garden, Francisville, Other" → array.
// Values beyond the core three (Francisville, Other) are kept as-is.
export function parseNeighborhoods(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// "September" + the form's 2026 context → 2026-09-01
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
export function parseMoveMonth(raw, year = 2026) {
  const idx = MONTHS.indexOf(String(raw || "").trim().toLowerCase());
  if (idx === -1) return null;
  return new Date(Date.UTC(year, idx, 1));
}

export function parseCreditBand(raw) {
  return CREDIT_BANDS[String(raw || "").trim()] || "UNKNOWN";
}

// five spellings of 733 N 24th St seen → one canonical string
export function normalizeProperty(raw) {
  const s = String(raw || "").trim();
  if (!s || /^(n\/?a|none)$/i.test(s)) return null;
  if (/733\s*n(orth)?\.?\s*24th\s*st(reet)?\.?/i.test(s)) return "733 N 24th St";
  return s;
}

export function yesNo(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "yes" || s === "true") return true;
  if (s === "no" || s === "false") return false;
  return null;
}

// ---------------------------------------------------------------------------
// Full form-row cleaner. Returns null when the validation gate drops the row
// (no name) — callers log drops, same discipline as the events pipeline.
// ---------------------------------------------------------------------------
export function cleanFormRow(row) {
  // headers in the real sheet have trailing spaces / long question text —
  // look fields up by fuzzy header match, never by exact string
  const key = (frag) => Object.keys(row).find((k) => k.toLowerCase().includes(frag.toLowerCase()));
  const get = (frag) => row[key(frag) ?? ""];

  const name = cleanName(get("Name"));
  if (!name) return null;

  const beds = parseBedrooms(get("Bedrooms"));
  const email = String(get("Email") || "").trim() || null;
  const timestamp = String(get("Timestamp") || "").trim();
  const contactedRaw = String(get("Contacted") || "").trim() || null;

  return {
    name,
    email,
    emailIsReal: false, // form emails are unverified until Julie confirms
    partners: String(get("Partner") || "").trim() || null,
    clientType: "RENTER",
    source: "FORM",
    neighborhoods: parseNeighborhoods(get("neighborhoods") ?? get("excited to help")),
    moveMonth: parseMoveMonth(get("month are you moving")),
    creditBand: parseCreditBand(get("credit score")),
    proofOfIncome: yesNo(get("proof of income")),
    whoLiving: String(get("Who will be living") || "").trim() || null,
    outOfState: yesNo(get("out of state")) === true,
    notes: String(get("Notes") || "").trim() || null,
    specificProperty: normalizeProperty(get("specific property")),
    maxRent: get("monthly rent") != null ? Math.round(Number(get("monthly rent"))) || null : null,
    bedroomsMin: beds.bedroomsMin,
    bedroomsRaw: beds.bedroomsRaw,
    pets: yesNo(get("Pets")) === true,
    takingOn: yesNo(get("Taking on")),
    contactedRaw,
    // sheet "Contacted? = sent" means Julie reached out around the row's time
    lastReachedOut: /sent/i.test(contactedRaw || "") && timestamp ? new Date(timestamp) : null,
    stage: /sent/i.test(contactedRaw || "") ? "CONTACTED" : "NEW",
    formKey: `${timestamp}|${name.toLowerCase()}`,
    rawSource: row,
    // client's own "Anything else important to note?" — becomes their first
    // ClientNote (not a DB column on Client)
    intakeNote: String(get("Anything else") || "").trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Actionability (14c): who needs Julie TODAY. Signals are contact-recency,
// due follow-ups, new leads, and stage — NEVER wealth/credit/neighborhood.
// ---------------------------------------------------------------------------
export function actionability(client, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (client.snoozedUntil && new Date(client.snoozedUntil) > now) {
    return { score: -1, reasons: ["Snoozed"], daysSinceContact: null };
  }
  let score = 0;
  const reasons = [];

  if (client.pinned) {
    score += 1000;
    reasons.push("Pinned by Julie");
  }
  if (client.followUpDue && new Date(client.followUpDue) <= now) {
    const daysOver = Math.floor((today - new Date(client.followUpDue)) / 86400000);
    score += 500 + daysOver * 10;
    reasons.push(daysOver > 0 ? `Follow-up ${daysOver}d overdue` : "Follow-up due today");
  }
  let daysSinceContact = null;
  if (client.lastReachedOut) {
    daysSinceContact = Math.floor((now - new Date(client.lastReachedOut)) / 86400000);
    if (daysSinceContact >= 7) {
      score += 100 + daysSinceContact;
      reasons.push(`Haven't spoken in ${daysSinceContact} days`);
    }
  } else {
    const ageDays = Math.floor((now - new Date(client.createdAt)) / 86400000);
    score += 200 + ageDays * 5;
    reasons.push(client.source === "FORM" ? "New lead — never contacted" : "Never contacted");
  }
  if (client.stage === "APPLICATION" || client.stage === "OFFER" || client.stage === "INSPECTION") {
    score += 150;
    reasons.push(`${STAGE_LABELS[client.stage]} — needs next step`);
  }
  return { score, reasons, daysSinceContact };
}
