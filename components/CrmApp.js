"use client";

// JulieTours CRM (Phase 14) — admin-only client component.
// Views: Today (actionability queue + real metric cards), Clients, Add,
// and a per-client profile with the adaptive pipeline stepper.
// Bell = in-app notification DROPDOWN (14e): no push, no email, ever.
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../app/Events.module.css";
import { useSaveFeedback } from "./Feedback";
import {
  stagesFor,
  STAGE_LABELS,
  CREDIT_WORDING,
  ACTIVE_CONTRACT_STAGES,
} from "../lib/crm";

const CREDIT_BANDS = [
  { key: "UNKNOWN", label: "Unknown" },
  { key: "UNDER_650", label: "Under 650" },
  { key: "B650_699", label: "650–699" },
  { key: "B700_749", label: "700–749" },
  { key: "B750_PLUS", label: "750+" },
];

// 18a — click-to-edit field. Renders the value; click turns it into the right
// input; Enter/blur or Save commits via onSave(value) and reverts on Escape.
function EditableField({ label, value, display, type = "text", options, fullWidth, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const start = () => { setDraft(value == null ? "" : String(value)); setEditing(true); };
  const commit = async () => { setEditing(false); await onSave(draft); };
  const cancel = () => setEditing(false);
  const shown = display != null ? display : (value == null || value === "" ? "—" : String(value));
  return (
    <div className={styles.detailGroup} style={fullWidth ? { gridColumn: "1 / -1" } : undefined}>
      <span className={styles.detailLabel}>{label}</span>
      {!editing ? (
        <button type="button" className={styles.detailEditable} onClick={start} title="Click to edit">
          <span className={styles.detailValue}>{shown}</span>
          <span className={styles.detailPencil} aria-hidden="true">✎</span>
        </button>
      ) : type === "select" ? (
        <div className={styles.detailEditRow}>
          <select className={styles.authInput} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus>
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button className={styles.detailSaveBtn} onMouseDown={(e) => e.preventDefault()} onClick={commit}>Save</button>
          <button className={styles.detailCancelBtn} onMouseDown={(e) => e.preventDefault()} onClick={cancel}>✕</button>
        </div>
      ) : type === "textarea" ? (
        <div className={styles.detailEditRow}>
          <textarea className={styles.authInput} rows={3} value={draft} autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") cancel(); }} />
          <button className={styles.detailSaveBtn} onMouseDown={(e) => e.preventDefault()} onClick={commit}>Save</button>
          <button className={styles.detailCancelBtn} onMouseDown={(e) => e.preventDefault()} onClick={cancel}>✕</button>
        </div>
      ) : (
        <div className={styles.detailEditRow}>
          <input className={styles.authInput} type={type} value={draft} autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }} />
          <button className={styles.detailSaveBtn} onMouseDown={(e) => e.preventDefault()} onClick={commit}>Save</button>
          <button className={styles.detailCancelBtn} onMouseDown={(e) => e.preventDefault()} onClick={cancel}>✕</button>
        </div>
      )}
    </div>
  );
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

// unknown stages (e.g. from an external writer) render prettified, never raw
const stageLabel = (s) =>
  STAGE_LABELS[s] || String(s || "").toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function EmailChip({ client }) {
  // Placeholder rule (14d): never let Julie fire an email at a fake address.
  if (client.email && client.emailIsReal) {
    return (
      <a className={styles.syncBtn} href={`mailto:${client.email}`}>
        ✉ Quick Email
      </a>
    );
  }
  return (
    <span className={styles.crmPlaceholder} title="No verified email on file — Quick Email disabled">
      ✉ {client.email ? "placeholder email" : "no email"}
    </span>
  );
}

export default function CrmApp() {
  const [view, setView] = useState("today"); // today | clients | add | settings
  const [openId, setOpenId] = useState(null);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [clients, setClients] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notif, setNotif] = useState({ items: [], unread: 0 });
  const [bellOpen, setBellOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [notice, setNotice] = useState("");
  const fb = useSaveFeedback();
  const [noteDraft, setNoteDraft] = useState({ body: "", remindAt: "" });
  const [add, setAdd] = useState({ clientType: "RENTER", source: "MANUAL", name: "", email: "", emailIsReal: false, phone: "", neighborhoods: "", maxRent: "", bedroomsMin: "", budget: "", financing: "", creditBand: "UNKNOWN", moveMonth: "", notes: "", pets: false });

  // cache: "no-store" on every CRM read — the browser must never serve a
  // stale HTTP-cached response (e.g. an empty one from just after a reset).
  const loadClients = useCallback(() => {
    fetch("/api/crm/clients", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .catch(() => setClients([]));
  }, []);
  const loadNotif = useCallback(() => {
    fetch("/api/crm/notifications", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.items && setNotif(d))
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadClients();
    loadNotif();
  }, [loadClients, loadNotif]);

  const openClient = useCallback((id) => {
    setOpenId(id);
    setDetail(null);
    fetch(`/api/crm/clients/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDetail(d.client || null))
      .catch(() => {});
  }, []);

  const patchClient = useCallback(
    async (id, patch, toastMsg) => {
      const res = await fetch(`/api/crm/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (d.client) {
        setDetail((prev) => (prev && prev.id === id ? d.client : prev));
        loadClients();
        loadNotif();
        if (toastMsg) fb.fireToast(toastMsg); // 18c: confirm every inline save
      } else if (d.error) {
        setNotice(d.error);
      }
      return d;
    },
    [loadClients, loadNotif, fb]
  );

  // ---- metrics (all real; zero when empty) ----
  const metrics = useMemo(() => {
    const list = clients || [];
    const now = new Date();
    return {
      priorities: list.filter((c) => c.action?.score > 0).length,
      followUps: list.filter((c) => c.followUpDue && new Date(c.followUpDue) <= now).length,
      newLeads: list.filter((c) => c.source === "FORM" && !c.lastReachedOut).length,
      contracts: list.filter(
        (c) => c.clientType === "BUYER" && ACTIVE_CONTRACT_STAGES.includes(c.stage)
      ).length,
    };
  }, [clients]);

  const queue = useMemo(
    () =>
      (clients || [])
        .filter((c) => c.action?.score > 0)
        .sort((a, b) => b.action.score - a.action.score)
        .slice(0, 10),
    [clients]
  );

  // Lead Pipeline funnel (15d) — unified across renter + buyer stages, REAL
  // counts. Renter and buyer stages map into five shared funnel buckets.
  // Unknown stages (e.g. n8n's LEAD / CREDIT_NURTURE) fall back to "Lead" so
  // the funnel always sums to the client total — the dashboard can't be
  // silently "empty" just because an external writer used a different word.
  const pipeline = useMemo(() => {
    const buckets = { Lead: 0, Showing: 0, Offer: 0, "Under Contract": 0, Closed: 0 };
    const map = {
      NEW: "Lead", NO_CONTRACT: "Lead", LEAD: "Lead", CREDIT_NURTURE: "Lead",
      CONTACTED: "Lead", SHOWING: "Showing",
      APPLICATION: "Offer", OFFER: "Offer",
      UNDER_CONTRACT: "Under Contract", INSPECTION: "Under Contract",
      FINANCING: "Under Contract", CLOSING_SCHEDULED: "Under Contract",
      LEASE_SIGNED: "Closed", CLOSED: "Closed",
    };
    for (const c of clients || []) {
      buckets[map[c.stage] || "Lead"]++; // unknown → earliest bucket
    }
    return buckets;
  }, [clients]);

  const filteredClients = useMemo(() => {
    let list = clients || [];
    if (typeFilter !== "ALL") list = list.filter((c) => c.clientType === typeFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => `${c.name} ${c.neighborhoods.join(" ")}`.toLowerCase().includes(q));
    return list;
  }, [clients, typeFilter, search]);

  async function submitAdd() {
    if (!add.name.trim()) {
      setNotice("A name is required.");
      return;
    }
    const res = await fetch("/api/crm/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(add),
    });
    const d = await res.json();
    if (!res.ok) {
      setNotice(d.error || "Couldn't add client.");
      return;
    }
    const savedName = add.name.trim();
    setNotice("");
    setAdd({ ...add, name: "", email: "", phone: "", neighborhoods: "", maxRent: "", bedroomsMin: "", budget: "", financing: "", notes: "" });
    loadClients();
    setView("clients");
    fb.fireCelebration(`${savedName} added! 🎉`); // 18b: explicit Add → celebrate
  }

  const clientRow = (c) => (
    <button key={c.id} className={styles.crmRow} onClick={() => openClient(c.id)}>
      <div className={styles.savedInfo}>
        <div className={styles.savedTitle}>
          {c.pinned && "📌 "}
          {c.name}
          <span className={styles.crmType}>{c.clientType === "BUYER" ? "Buyer" : "Renter"}</span>
        </div>
        <div className={styles.savedMeta}>
          {[
            c.neighborhoods.slice(0, 3).join(", ") || null,
            c.clientType === "BUYER"
              ? c.budget ? `budget $${c.budget.toLocaleString()}` : null
              : c.maxRent ? `up to $${c.maxRent.toLocaleString()}/mo` : null,
            stageLabel(c.stage),
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {(c.tags || []).length > 0 && (
          <div className={styles.wTags}>
            {c.tags.map((t) => (
              <span key={t.id} className={styles.tag}>🏷 {t.name}</span>
            ))}
          </div>
        )}
      </div>
      <span className={styles.pastChev}>›</span>
    </button>
  );

  // ------------------------------------------------------------------ render
  return (
    <div className={styles.shell}>
      {/* banner (provided artwork, cropped above its static metric strip) +
          the REAL bell overlaid where the baked-in one sits */}
      <header className={styles.crmBanner}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/theme/crm-banner.png" alt="JulieTours — CRM + Event Management" />
        <div className={styles.crmBellWrap}>
          <button
            className={styles.iconBtn}
            aria-label="CRM settings"
            style={{ marginRight: 8 }}
            onClick={() => { setOpenId(null); setView("settings"); }}
          >
            ⚙
          </button>
          <button className={styles.iconBtn} aria-label="CRM notifications" onClick={() => setBellOpen((v) => !v)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.iconImg} src="/icons/bell.png" alt="" />
            {notif.unread > 0 && (
              <span className={styles.bellBadge}>{notif.unread > 9 ? "9+" : notif.unread}</span>
            )}
          </button>
          {bellOpen && (
            <>
              <div className={styles.bellScrim} onClick={() => setBellOpen(false)} />
              <div className={styles.notifPanel}>
                <div className={styles.notifHead}>
                  <h3>Notifications</h3>
                  {notif.items.length > 0 && (
                    <>
                      <button
                        className={styles.notifClear}
                        onClick={() =>
                          fetch("/api/crm/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"action":"markAllRead"}' }).then(loadNotif)
                        }
                      >
                        Mark read
                      </button>
                      <button
                        className={styles.notifClear}
                        onClick={() =>
                          fetch("/api/crm/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"action":"clearAll"}' }).then(loadNotif)
                        }
                      >
                        Clear
                      </button>
                    </>
                  )}
                  <button className={styles.notifClose} aria-label="Close" onClick={() => setBellOpen(false)}>✕</button>
                </div>
                {notif.items.length === 0 ? (
                  <p className={styles.notifEmpty}>Nothing waiting — enjoy the quiet.</p>
                ) : (
                  <div className={styles.notifList}>
                    {notif.items.map((n) => (
                      <div
                        key={n.id}
                        className={styles.notifRow}
                        style={{ opacity: n.read ? 0.65 : 1 }}
                        onClick={() => {
                          fetch("/api/crm/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "markRead", id: n.id }) }).then(loadNotif);
                          if (n.clientId) {
                            openClient(n.clientId);
                            setBellOpen(false);
                          }
                        }}
                      >
                        <div className={styles.notifTitle}>{n.read ? "" : "● "}{n.title}</div>
                        {n.body && <div className={styles.notifMsg}>{n.body}</div>}
                        <div className={styles.notifTime}>{new Date(n.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* real metric cards — mockup style, honest numbers.
          15b: DASHBOARD ONLY — never on the individual profile view. */}
      {!openId && (
        <div className={styles.conMetrics} data-cols="4">
          <div className={styles.conMetric}><span>⭐ My Priorities</span><b>{clients ? metrics.priorities : "…"}</b><em>need action</em></div>
          <div className={styles.conMetric}><span>🗓 Follow-ups</span><b>{clients ? metrics.followUps : "…"}</b><em>due now</em></div>
          <div className={styles.conMetric}><span>👤 New Leads</span><b>{clients ? metrics.newLeads : "…"}</b><em>never contacted</em></div>
          <div className={styles.conMetric}><span>💼 Active Contracts</span><b>{clients ? metrics.contracts : "…"}</b><em>buyers in play</em></div>
        </div>
      )}

      {notice && <p className={styles.calNotice}>{notice}</p>}

       {/* ---------- PROFILE (redesigned to match mockup) ---------- */}
        {openId && (
          <div className={styles.panel} style={{ padding: 0, overflow: 'hidden', background: '#fff' }}>
            {/* 15c: back button — returns to the client list */}
            <button
              className={styles.crmBack}
              onClick={() => { setOpenId(null); setDetail(null); setView("clients"); }}
            >
              ‹ {detail ? detail.name : "Back to clients"}
            </button>
            {!detail ? (
              <p className={styles.calBlurb} style={{ padding: 24 }}>Loading…</p>
            ) : (
              <div className={styles.crmProfile}>

                {/* HEADER CARD */}
                <div className={styles.profileHeader}>
                  <div className={styles.profileAvatar}>
                    {detail.name ? detail.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className={styles.profileMeta}>
                    <h2 className={styles.profileName}>
                      {detail.pinned && '📌 '}
                      {detail.name}
                    </h2>
                    <div className={styles.profileBadges}>
                      <span className={styles.crmType}>{detail.clientType === 'BUYER' ? 'Buyer' : 'Renter'}</span>
                      <span className={styles.profileSource}>via {detail.source.toLowerCase()}</span>
                      <span className={styles.profileDate}>added {fmtDate(detail.createdAt)}</span>
                      {detail.takingOn === false && <span className={styles.profileWarning}>⛔ Not taking on</span>}
                    </div>
                    <div className={styles.profileTags}>
                      {(detail.tags || []).map((t) => (
                        <span key={t.id} className={styles.tag}>🏷 {t.name}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* STATS ROW (matching mockup: Last contact, Follow-up due, Credit, Stage) */}
                <div className={styles.profileStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Last contact</span>
                    <span className={styles.statValue}>{fmtDate(detail.lastReachedOut)}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Follow-up due</span>
                    <span className={styles.statValue} style={{ color: detail.followUpDue && new Date(detail.followUpDue) <= new Date() ? '#b33a34' : 'inherit' }}>
                      {fmtDate(detail.followUpDue)}
                    </span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Credit</span>
                    <span className={styles.statValue}>{CREDIT_WORDING[detail.creditBand]}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Stage</span>
                    <span className={styles.statValue}>{stageLabel(detail.stage)}</span>
                  </div>
                </div>

                {/* PIPELINE STEPPER (Transaction Tracker) */}
                <div className={styles.stepper}>
                  {stagesFor(detail.clientType).map((s) => (
                    <button
                      key={s}
                      className={styles.step}
                      data-state={
                        s === detail.stage
                          ? 'current'
                          : stagesFor(detail.clientType).indexOf(s) < stagesFor(detail.clientType).indexOf(detail.stage)
                          ? 'done'
                          : 'todo'
                      }
                      onClick={() => s !== detail.stage && patchClient(detail.id, { stage: s })}
                    >
                      {STAGE_LABELS[s]}
                    </button>
                  ))}
                </div>

                {/* TWO-COLUMN LAYOUT: NOTES & REMINDERS | DETAILS */}
                <div className={styles.crmTwoCol}>
                  {/* LEFT: Notes & Reminders */}
                  <div className={styles.crmNotesCol}>
                    <h4 className={styles.colTitle}>🗒 Notes & Reminders</h4>
                    <div className={styles.conForm} style={{ marginBottom: 12 }}>
                      <textarea
                        className={styles.authInput}
                        rows={2}
                        placeholder="Add a note…"
                        value={noteDraft.body}
                        onChange={(e) => setNoteDraft({ ...noteDraft, body: e.target.value })}
                      />
                      <div className={styles.conFormRow}>
                        <input
                          className={styles.authInput}
                          type="date"
                          value={noteDraft.remindAt}
                          onChange={(e) => setNoteDraft({ ...noteDraft, remindAt: e.target.value })}
                          title="Optional reminder date"
                        />
                        <button
                          className={styles.syncBtn}
                          onClick={async () => {
                            if (!noteDraft.body.trim()) return;
                            await fetch(`/api/crm/clients/${detail.id}/notes`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(noteDraft),
                            });
                            setNoteDraft({ body: '', remindAt: '' });
                            openClient(detail.id);
                            loadClients();
                            fb.fireToast(noteDraft.remindAt ? "Note + reminder added" : "Note added");
                          }}
                        >
                          Add note{noteDraft.remindAt ? ' + reminder' : ''}
                        </button>
                      </div>
                    </div>
                    {(detail.clientNotes || []).length === 0 ? (
                      <p className={styles.notifEmpty} style={{ padding: '10px 0' }}>No notes yet</p>
                    ) : (
                      (detail.clientNotes || []).map((n) => (
                        <div key={n.id} className={styles.savedRow} style={{ marginBottom: 6 }}>
                          <div className={styles.savedInfo}>
                            <div className={styles.savedMeta}>{n.body}</div>
                            <div className={styles.notifTime}>
                              {fmtDate(n.createdAt)}
                              {n.remindAt && ` · ⏰ reminds ${fmtDate(n.remindAt)}`}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* RIGHT: All Details (Personal, Housing, Financial) */}
                  <div className={styles.crmDetailsCol}>
                    <h4 className={styles.colTitle}>📋 Client Details</h4>
                    {/* 18a: every field click-to-edit; each save toasts */}
                    <div className={styles.detailGrid}>
                      <EditableField label="Name" value={detail.name}
                        onSave={(v) => patchClient(detail.id, { name: v }, "Name saved")} />
                      <EditableField label="Client type" type="select" value={detail.clientType}
                        options={[{ key: "RENTER", label: "Renter" }, { key: "BUYER", label: "Buyer" }]}
                        display={detail.clientType === "BUYER" ? "Buyer" : "Renter"}
                        onSave={(v) => patchClient(detail.id, { clientType: v }, "Client type saved")} />
                      <EditableField label="Email" type="email" value={detail.email}
                        onSave={(v) => patchClient(detail.id, { email: v, emailIsReal: Boolean(v.trim()) }, "Email saved")} />
                      <EditableField label="Phone" type="tel" value={detail.phone}
                        onSave={(v) => patchClient(detail.id, { phone: v }, "Phone saved")} />
                      <EditableField label="Partners" value={detail.partners}
                        onSave={(v) => patchClient(detail.id, { partners: v }, "Saved")} />
                      <EditableField label="Household" value={detail.whoLiving}
                        onSave={(v) => patchClient(detail.id, { whoLiving: v }, "Saved")} />
                      <EditableField label="Neighborhoods" value={(detail.neighborhoods || []).join(', ')}
                        display={(detail.neighborhoods || []).join(', ') || '—'}
                        onSave={(v) => patchClient(detail.id, { neighborhoods: v.split(',').map((s) => s.trim()).filter(Boolean) }, "Neighborhoods saved")} />
                      <EditableField label="Move month" type="month"
                        value={detail.moveMonth ? new Date(detail.moveMonth).toISOString().slice(0, 7) : ''}
                        display={detail.moveMonth ? new Date(detail.moveMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                        onSave={(v) => patchClient(detail.id, { moveMonth: v || null }, "Move month saved")} />
                      {detail.clientType === 'RENTER' ? (
                        <>
                          <EditableField label="Max rent" type="number" value={detail.maxRent}
                            display={detail.maxRent ? `$${detail.maxRent.toLocaleString()}/mo` : '—'}
                            onSave={(v) => patchClient(detail.id, { maxRent: v }, "Max rent saved")} />
                          <EditableField label="Bedrooms" value={detail.bedroomsRaw}
                            display={detail.bedroomsRaw || detail.bedroomsMin || '—'}
                            onSave={(v) => patchClient(detail.id, { bedroomsRaw: v }, "Bedrooms saved")} />
                          <EditableField label="Pets" type="select" value={detail.pets ? 'true' : 'false'}
                            options={[{ key: "false", label: "No" }, { key: "true", label: "Yes" }]}
                            display={detail.pets ? 'Yes' : 'No'}
                            onSave={(v) => patchClient(detail.id, { pets: v === 'true' }, "Pets saved")} />
                        </>
                      ) : (
                        <>
                          <EditableField label="Budget" type="number" value={detail.budget}
                            display={detail.budget ? `$${detail.budget.toLocaleString()}` : '—'}
                            onSave={(v) => patchClient(detail.id, { budget: v }, "Budget saved")} />
                          <EditableField label="Financing" value={detail.financing}
                            onSave={(v) => patchClient(detail.id, { financing: v }, "Financing saved")} />
                        </>
                      )}
                      <EditableField label="Credit" type="select" value={detail.creditBand}
                        options={CREDIT_BANDS} display={CREDIT_WORDING[detail.creditBand]}
                        onSave={(v) => patchClient(detail.id, { creditBand: v }, "Credit saved")} />
                      <EditableField label="Proof of income" type="select"
                        value={detail.proofOfIncome === true ? 'true' : detail.proofOfIncome === false ? 'false' : 'null'}
                        options={[{ key: "null", label: "—" }, { key: "true", label: "Yes" }, { key: "false", label: "No" }]}
                        display={detail.proofOfIncome === true ? 'Yes' : detail.proofOfIncome === false ? 'No' : '—'}
                        onSave={(v) => patchClient(detail.id, { proofOfIncome: v === 'null' ? null : v === 'true' }, "Saved")} />
                      <EditableField label="Out of state" type="select" value={detail.outOfState ? 'true' : 'false'}
                        options={[{ key: "false", label: "No" }, { key: "true", label: "Yes" }]}
                        display={detail.outOfState ? 'Yes' : 'No'}
                        onSave={(v) => patchClient(detail.id, { outOfState: v === 'true' }, "Saved")} />
                      <EditableField label="Property of interest" value={detail.specificProperty}
                        onSave={(v) => patchClient(detail.id, { specificProperty: v }, "Saved")} />
                      <EditableField label="Notes" type="textarea" value={detail.notes} fullWidth
                        display={detail.notes ? detail.notes : '—'}
                        onSave={(v) => patchClient(detail.id, { notes: v }, "Notes saved")} />
                    </div>
                  </div>
                </div>

               {/* ---- ACTIONS + VERIFY + TAGS (tightly integrated) ---- */}
              <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--line, #eae4dd)', marginTop: 0 }}>
                {/* Action buttons — row wrapping */}
                <div className={styles.crmActions} style={{ marginTop: 16, flexWrap: 'wrap', gap: 8, padding: 0 }}>
                  <EmailChip client={detail} />
                  <button className={styles.conToggle} onClick={() => patchClient(detail.id, { markContacted: true }, "Marked contacted")}>
                    ✓ Mark contacted
                  </button>
                  <button className={styles.conToggle} data-on={detail.pinned} onClick={() => patchClient(detail.id, { pinned: !detail.pinned }, detail.pinned ? "Unpinned" : "Pinned to top")}>
                    📌 {detail.pinned ? 'Unpin' : 'Pin to top'}
                  </button>
                  <button className={styles.conToggle} onClick={() => patchClient(detail.id, { snoozeDays: 3 }, "Snoozed 3 days")}>💤 Snooze 3d</button>
                  <button className={styles.conToggle} onClick={() => patchClient(detail.id, { followUpDue: new Date(Date.now() + 7 * 86400000).toISOString() }, "Follow-up set +7d")}>⏰ Follow up +7d</button>
                </div>

                {/* Verify email row */}
                <div className={styles.conFormRow} style={{ marginTop: 12, maxWidth: '100%' }}>
                  <input
                    key={`email-${detail.id}`}
                    className={styles.authInput}
                    placeholder="Verified email address"
                    defaultValue={detail.email || ''}
                    id="crm-email-input"
                    style={{ flex: '1 1 200px' }}
                  />
                  <button
                    className={styles.syncBtn}
                    onClick={async () => {
                      const v = document.getElementById('crm-email-input').value;
                      await patchClient(detail.id, { email: v, emailIsReal: Boolean(v.trim()) }, v.trim() ? "Email verified — Quick Email is live" : "Email cleared");
                    }}
                    style={{ flex: '0 0 auto' }}
                  >
                    Save as real
                  </button>
                </div>

                {/* Tags row */}
                <div className={styles.conFormRow} style={{ marginTop: 8 }}>
                  <input
                    key={`tags-${detail.id}-${(detail.tags || []).length}`}
                    className={styles.authInput}
                    placeholder="Tags (comma separated — descriptive only)"
                    defaultValue={(detail.tags || []).map((t) => t.name).join(', ')}
                    id="crm-tags-input"
                    style={{ flex: '1 1 200px' }}
                  />
                  <button
                    className={styles.conToggle}
                    onClick={async () => {
                      const tags = document.getElementById('crm-tags-input').value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      await patchClient(detail.id, { tags }, tags.length ? "Tag added" : "Tags cleared");
                    }}
                    style={{ flex: '0 0 auto' }}
                  >
                    Save tags
                  </button>
                </div>

                {/* 18b: explicit "Done" → the big checkmark + confetti moment */}
                <div className={styles.crmDoneRow}>
                  <button
                    className={styles.syncBtn}
                    onClick={() => {
                      fb.fireCelebration("Client saved! 🎉");
                      setTimeout(() => { setOpenId(null); setDetail(null); setView("clients"); }, 1400);
                    }}
                  >
                    ✓ Done
                  </button>
                </div>
              </div>

              </div>
            )}
          </div>
        )}
                  

      {/* ---------------- today ---------------- */}
      {!openId && view === "today" && (
       <>
        {/* Lead Pipeline strip (15d) — real counts across the funnel */}
        <div className={styles.panel}>
          <div className={styles.panelHead}><h2>🔻 Lead Pipeline</h2></div>
          <div className={styles.pipelineStrip}>
            {Object.entries(pipeline).map(([label, count], i, arr) => (
              <div key={label} className={styles.pipelineStep}>
                <div className={styles.pipelineCount}>{clients ? count : "…"}</div>
                <div className={styles.pipelineLabel}>{label}</div>
                {i < arr.length - 1 && <span className={styles.pipelineArrow}>→</span>}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}><h2>☀️ Today&apos;s Top Clients</h2></div>
          <p className={styles.calBlurb}>
            Ranked by who needs action — follow-ups due, silence too long, new leads. Never by budget or credit.
          </p>
          {clients === null ? (
            <p className={styles.calBlurb}>Loading…</p>
          ) : queue.length === 0 ? (
            <div className={styles.empty}>
              <h3>All caught up 🤍</h3>
              <p>No one needs action right now. New leads and due follow-ups will appear here.</p>
            </div>
          ) : (
            queue.map((c) => (
              <div key={c.id} className={styles.queueCard}>
                <div className={styles.savedInfo}>
                  <div className={styles.savedTitle}>
                    {c.pinned && "📌 "}
                    {c.name}
                    <span className={styles.crmType}>{c.clientType === "BUYER" ? "Buyer" : "Renter"}</span>
                  </div>
                  <div className={styles.savedMeta}>
                    {[
                      c.neighborhoods.slice(0, 3).join(", ") || null,
                      c.clientType === "BUYER"
                        ? c.budget ? `budget $${c.budget.toLocaleString()}` : null
                        : c.maxRent ? `up to $${c.maxRent.toLocaleString()}/mo` : null,
                      `credit: ${CREDIT_WORDING[c.creditBand]}`,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  <div className={styles.queueReasons}>
                    {c.action.reasons.map((r) => (
                      <span key={r} className={styles.queueReason}>⚠ {r}</span>
                    ))}
                  </div>
                  {(c.tags || []).length > 0 && (
                    <div className={styles.wTags}>
                      {c.tags.map((t) => (
                        <span key={t.id} className={styles.tag}>🏷 {t.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.crmActions} data-stack="true">
                  <EmailChip client={c} />
                  <button className={styles.conToggle} onClick={() => patchClient(c.id, { markContacted: true })}>✓ Contacted</button>
                  <button className={styles.conToggle} onClick={() => openClient(c.id)}>Open</button>
                </div>
              </div>
            ))
          )}
        </div>
       </>
      )}

      {/* ---------------- clients ---------------- */}
      {!openId && view === "clients" && (
        <div className={styles.panel}>
          <div className={styles.panelHead}><h2>👥 Clients {clients ? `(${filteredClients.length})` : ""}</h2></div>
          <input className={styles.vSearch} placeholder="Search name or neighborhood…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className={styles.subRow}>
            {["ALL", "RENTER", "BUYER"].map((t) => (
              <button key={t} className={styles.subChip} data-active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                {t === "ALL" ? "All" : t === "RENTER" ? "Renters" : "Buyers"}
              </button>
            ))}
          </div>
          {clients === null ? (
            <p className={styles.calBlurb}>Loading…</p>
          ) : filteredClients.length === 0 ? (
            <div className={styles.empty}><h3>No clients yet</h3><p>Form leads sync in automatically; add walk-ins with ＋.</p></div>
          ) : (
            filteredClients.map(clientRow)
          )}
        </div>
      )}

      {/* ---------------- add ---------------- */}
      {!openId && view === "add" && (
        <div className={styles.panel}>
          <div className={styles.panelHead}><h2>＋ Add Client</h2></div>
          <p className={styles.calBlurb}>Phone call, text, or referral — same record shape as form leads.</p>
          <div className={styles.conForm}>
            <div className={styles.conFormRow}>
              <select className={styles.authInput} value={add.clientType} onChange={(e) => setAdd({ ...add, clientType: e.target.value })}>
                <option value="RENTER">Renter</option>
                <option value="BUYER">Buyer</option>
              </select>
              <select className={styles.authInput} value={add.source} onChange={(e) => setAdd({ ...add, source: e.target.value })}>
                <option value="MANUAL">Manual</option>
                <option value="CALL">Phone call</option>
                <option value="TEXT">Text</option>
                <option value="REFERRAL">Referral</option>
              </select>
            </div>
            <input className={styles.authInput} placeholder="Name *" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
            <div className={styles.conFormRow}>
              <input className={styles.authInput} placeholder="Email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} />
              <input className={styles.authInput} placeholder="Phone" value={add.phone} onChange={(e) => setAdd({ ...add, phone: e.target.value })} />
            </div>
            <label className={styles.crmCheck}>
              <input type="checkbox" checked={add.emailIsReal} onChange={(e) => setAdd({ ...add, emailIsReal: e.target.checked })} />
              This email is verified/real
            </label>
            <input className={styles.authInput} placeholder="Neighborhoods (comma separated)" value={add.neighborhoods} onChange={(e) => setAdd({ ...add, neighborhoods: e.target.value })} />
            {add.clientType === "RENTER" ? (
              <div className={styles.conFormRow}>
                <input className={styles.authInput} placeholder="Max rent ($/mo)" value={add.maxRent} onChange={(e) => setAdd({ ...add, maxRent: e.target.value })} />
                <input className={styles.authInput} placeholder="Bedrooms (min)" value={add.bedroomsMin} onChange={(e) => setAdd({ ...add, bedroomsMin: e.target.value })} />
              </div>
            ) : (
              <div className={styles.conFormRow}>
                <input className={styles.authInput} placeholder="Budget ($)" value={add.budget} onChange={(e) => setAdd({ ...add, budget: e.target.value })} />
                <input className={styles.authInput} placeholder="Financing (e.g. pre-approved)" value={add.financing} onChange={(e) => setAdd({ ...add, financing: e.target.value })} />
              </div>
            )}
            <div className={styles.conFormRow}>
              <select className={styles.authInput} value={add.creditBand} onChange={(e) => setAdd({ ...add, creditBand: e.target.value })}>
                <option value="UNKNOWN">Credit band unknown</option>
                <option value="B750_PLUS">750+ (Excellent)</option>
                <option value="B700_749">700–749 (Good)</option>
                <option value="B650_699">650–699 (Fair)</option>
                <option value="UNDER_650">Under 650</option>
              </select>
              <input className={styles.authInput} type="date" title="Move month" value={add.moveMonth} onChange={(e) => setAdd({ ...add, moveMonth: e.target.value })} />
            </div>
            <label className={styles.crmCheck}>
              <input type="checkbox" checked={add.pets} onChange={(e) => setAdd({ ...add, pets: e.target.checked })} />
              Has pets
            </label>
            <textarea className={styles.authInput} rows={2} placeholder="Notes" value={add.notes} onChange={(e) => setAdd({ ...add, notes: e.target.value })} />
            <button className={styles.syncBtn} onClick={submitAdd}>Add client</button>
          </div>
        </div>
      )}

      {/* ---------------- settings (15e reset) ---------------- */}
      {!openId && view === "settings" && (
        <div className={styles.panel}>
          <div className={styles.panelHead}><h2>⚙ CRM Settings</h2></div>
          <div className={styles.resetBox}>
            <h3>Reset CRM data</h3>
            <p className={styles.calBlurb}>
              Permanently deletes <b>all clients, notes, tags, and CRM notifications</b> so
              you can verify a fresh Google Sheet sync. This does <b>not</b> touch events,
              posts, the playbook, viewer accounts, or anything else. There is no undo.
            </p>
            <p className={styles.calBlurb}>
              Type <b>RESET</b> to confirm:
            </p>
            <div className={styles.conFormRow}>
              <input
                className={styles.authInput}
                placeholder="RESET"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
              />
              <button
                className={styles.resetBtn}
                disabled={resetConfirm !== "RESET" || resetting}
                onClick={async () => {
                  setResetting(true);
                  const res = await fetch("/api/crm/reset", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ confirm: "RESET" }),
                  });
                  const d = await res.json();
                  setResetting(false);
                  setResetConfirm("");
                  if (res.ok) {
                    setNotice(`✅ CRM cleared — ${d.deleted.clients} clients removed. Ready for a fresh sync.`);
                    loadClients();
                    loadNotif();
                    setView("today");
                  } else {
                    setNotice(d.error || "Reset failed.");
                  }
                }}
              >
                {resetting ? "Resetting…" : "🗑 Reset CRM data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* bottom nav */}
      <nav className={styles.bottomNav} data-cols="4">
        {/* eslint-disable @next/next/no-img-element */}
        <a className={styles.navItem} href="/admin">
          <span><img className={styles.navImg} src="/icons/home.png" alt="" /></span>Events
        </a>
        <button className={styles.navItem} data-active={!openId && view === "today"} onClick={() => { setOpenId(null); setView("today"); }}>
          <span><img className={styles.navImg} src="/icons/achievements.png" alt="" /></span>Today
        </button>
        <button className={styles.navItem} data-active={!openId && view === "clients"} onClick={() => { setOpenId(null); setView("clients"); }}>
          <span><img className={styles.navImg} src="/icons/profile.png" alt="" /></span>Clients
        </button>
        <button className={styles.navItem} data-active={!openId && view === "add"} onClick={() => { setOpenId(null); setView("add"); }}>
          <span><img className={styles.navImg} src="/icons/events.png" alt="" /></span>＋ Add
        </button>
        {/* eslint-enable @next/next/no-img-element */}
      </nav>
      {fb.node}
    </div>
  );
}
