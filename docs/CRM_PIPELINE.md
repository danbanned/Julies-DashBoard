# CRM ingestion pipeline (Phase 14b)

**Flow:** Google Form → Google Sheets → n8n (cleanup crew) → `POST /api/crm/sync` → Neon.

n8n sanitizes and validates ONLY — no scores, no business logic (that lives in
the app where it's testable). The same cleaning rules are also implemented in
`lib/crm.js`, so the sync route tolerates raw-ish rows; n8n cleaning is a
courtesy, the app is the authority.

**PII rule:** client data is admin-only. It never goes over ntfy, push, or
email. The sync endpoint accepts only Julie's session or the shared secret.

## n8n workflow

1. **Google Sheets Trigger** (or Cron + Read Rows) on the responses sheet.
2. **Code node** — map each row to `{ rows: [ {…row-as-object…} ] }` keyed by
   the sheet headers verbatim. Cleanup the app expects (or performs itself):
   - Bedrooms free text → keep raw; app derives the minimum int
     (`3+`→3, `3-4`→3, `<=2`→2, `"Any"`→null, `"3 or more. 2 full bath."`→3).
   - Neighborhood comma-string stays a string; app splits to an array
     (values beyond the core three — Francisville, "Other" — are kept).
   - Names get trimmed/title-cased by the app (`"alexandria eley"` →
     `Alexandria Eley`).
   - Move month resolves against the form's 2026 context (`"September"` →
     2026-09-01).
   - Credit stays a BAND (`Under 650` / `650-699` / `700-749` / `750+`) —
     never a raw score, by design.
   - `733 N 24th St` spelling variants normalize to one canonical string.
   - Julie's own columns — `Contacted?` ("sent"), `Taking on?`, `Notes` — are
     ingested as her existing status (contacted→stage CONTACTED +
     lastReachedOut), not discarded.
   - Validation gate: rows with no name are dropped and counted in the
     response (`dropped`).
3. **HTTP Request node**
   - `POST https://<your-domain>/api/crm/sync`
   - Headers: `Content-Type: application/json`,
     `x-crm-secret: <CRM_SYNC_SECRET from .env>`
   - Body: `{ "rows": [ ...sheet rows... ] }`

The route is idempotent: rows upsert by a stable `formKey`
(timestamp + name). Re-syncs refresh sheet-owned fields but never clobber
Julie's workflow state (stage, pins, follow-ups, contact history).

Manual test:

```bash
curl -X POST https://<domain>/api/crm/sync \
  -H "Content-Type: application/json" \
  -H "x-crm-secret: $CRM_SYNC_SECRET" \
  -d '{"rows":[{"Timestamp":"2026-07-16 09:00:00","Name":"Test Person","# of Bedrooms":"2-3","Maximum monthly rent":2200,"Your estimated credit score":"700-749","I'\''m excited to help you find your next home! Which neighborhoods are you interested in?":"Fairmount, Brewerytown"}]}'
```

## Where things live in the app

- `/admin/crm` — Today's queue, Clients, Add Client (all admin-gated).
- Actionability ranking (14c): follow-ups due, days-since-contact, new leads,
  stage-needs-a-next-step. Never wealth, credit, or neighborhood. **Note for
  the future:** if anyone asks for weighted people-ranking using income /
  credit / neighborhood factors, that requires a fair-housing legal review
  first — do not just build it.
- Notification center (14e): the bell dropdown on `/admin/crm`, DB-backed,
  in-app only. The CRM never pushes, emails, or texts.
