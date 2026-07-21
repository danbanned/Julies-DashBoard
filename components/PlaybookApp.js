"use client";

// Julie's Content Playbook (15f) — native, DB-backed, editable, admin-only.
// Hub (pillar grid + counts + Getting Started + Neighborhood cards + tabs),
// section detail with full CRUD on blocks/callouts, a "+ New Idea" composer,
// and a print-optimized Export (15g).
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "../app/Events.module.css";
import { useSaveFeedback } from "./Feedback";

const CALLOUT_META = {
  CONTENT_IDEA: { icon: "💡", label: "Content Idea" },
  REEL_IDEA: { icon: "🎥", label: "Reel Idea" },
  SHOOT_HERE: { icon: "📍", label: "Shoot Here" },
  WHY_IT_WORKS: { icon: "📈", label: "Why it Works" },
  DONT_DO_THIS: { icon: "⚠️", label: "Don't Do This" },
  PRO_TIP: { icon: "⭐", label: "Pro Tip" },
  NOTE: { icon: "🗂", label: "Note" },
};
const stripMd = (s) => String(s || "").replace(/\*\*/g, "").replace(/^\s*[-•]\s*/, "");
// callout text is "Label: body" — show just the body (type conveys the label)
const calloutBody = (t) => {
  const s = stripMd(t);
  const i = s.indexOf(":");
  return i > 0 && i < 30 ? s.slice(i + 1).trim() : s;
};

// Make Notion-exported markdown safe for GFM: (1) ensure a blank line before a
// table/heading that follows other content, and (2) normalize every table row
// to its header's column count (some export rows have an extra/missing cell,
// which stops GFM from rendering the table). Used by the UI and the PDF export.
// A table row whose cell holds a newline arrives split across lines (starts
// with "|" but doesn't close with "|"). GFM — and our card parser — need each
// row on ONE line, so fold continuation lines up until the row closes with "|".
function stitchTableRows(raw) {
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    let line = raw[i];
    const t = line.trim();
    if (t.startsWith("|") && !t.endsWith("|")) {
      while (i + 1 < raw.length && !line.trim().endsWith("|")) {
        i++;
        line = line.replace(/\s+$/, "") + " " + raw[i].trim();
      }
    }
    lines.push(line);
  }
  return lines;
}

export function normalizeMd(md) {
  const lines = stitchTableRows(String(md || "").split("\n"));
  const spaced = [];
  for (const line of lines) {
    const cur = line.trim();
    const prev = spaced.length ? spaced[spaced.length - 1].trim() : "";
    if (prev && prev !== "" && !prev.startsWith("|") && (cur.startsWith("|") || /^#{1,6}\s/.test(cur))) {
      spaced.push("");
    }
    spaced.push(line);
  }
  // reconstruct table rows to a consistent column count
  const out = [];
  let cols = 0;
  let inTable = false;
  for (const line of spaced) {
    const t = line.trim();
    if (t.startsWith("|")) {
      const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      if (!inTable) { inTable = true; cols = cells.length; }
      const isSep = cells.every((c) => /^:?-+:?$/.test(c) || c === "");
      if (isSep) {
        out.push("| " + Array.from({ length: cols }, () => "---").join(" | ") + " |");
      } else {
        while (cells.length < cols) cells.push("");
        if (cells.length > cols) cells.splice(cols - 1, cells.length - cols + 1, cells.slice(cols - 1).join(" "));
        out.push("| " + cells.join(" | ") + " |");
      }
    } else {
      inTable = false;
      cols = 0;
      out.push(line);
    }
  }
  return out.join("\n");
}

// GFM markdown renderer (16c). Tables get a horizontally-scrollable wrapper so
// wide tables stay usable at 375px; lists/tables/bold all render as real HTML.
const MD_COMPONENTS = {
  table: (props) => (
    <div className={styles.pbTableWrap}>
      <table {...props} />
    </div>
  ),
  a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};
function Markdown({ children }) {
  if (!children) return null;
  return (
    <div className={styles.pbMd}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {normalizeMd(children)}
      </ReactMarkdown>
    </div>
  );
}

// Parse a GFM table out of a block body into header + data rows (each keeps
// its exact source line so a single row can be deleted precisely, 16d).
function tableFromBody(body) {
  const lines = stitchTableRows(String(body || "").split("\n"));
  const start = lines.findIndex((l) => l.trim().startsWith("|"));
  if (start < 0) return null;
  // first CONTIGUOUS run of table lines (a block may hold a 2nd table below)
  let end = start;
  while (end < lines.length && lines[end].trim().startsWith("|")) end++;
  const tableLines = lines.slice(start, end);
  if (tableLines.length < 2) return null;
  const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const isSeparator = (l) => /^\|?[\s:|-]+\|?$/.test(l.trim());
  const headers = cells(tableLines[0]);
  const rows = tableLines
    .slice(1)
    .filter((l) => !isSeparator(l))
    .map((l) => ({ line: l, cells: cells(l) }))
    .filter((r) => r.cells.some((c) => c));
  if (!rows.length) return null;
  const remainder = lines.slice(end).join("\n").trim();
  return { headers, rows, remainder };
}
function priorityMeta(cell) {
  const c = String(cell || "");
  if (/🔴|high/i.test(c)) return { dot: "🔴", label: "High" };
  if (/🟡|med/i.test(c)) return { dot: "🟡", label: "Med" };
  if (/🟢|low/i.test(c)) return { dot: "🟢", label: "Low" };
  return { dot: "", label: stripMd(c) };
}

const NEIGHBORHOOD_CARDS = [
  { key: "Fairmount", title: "FAIRMOUNT", tagline: "Historic Beauty. Natural Serenity.", cover: "/fallbacks/FairMount/fairmountpark.png" },
  { key: "Brewerytown", title: "BREWERYTOWN", tagline: "Local Flavor. City Vibes.", cover: "/playbook/BTIMAGE.jpg" },
];

export default function PlaybookApp() {
  const [data, setData] = useState(null); // { pillars, counts, total }
  const [tab, setTab] = useState("all"); // all | Fairmount | Brewerytown | inspiration
  const [openSection, setOpenSection] = useState(null);
  const [notice, setNotice] = useState("");
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [editingId, setEditingId] = useState(null); // 18a: "section:id" | "block:id" | "callout:id"
  const fb = useSaveFeedback();

  const load = useCallback(() => {
    fetch("/api/playbook")
      .then((r) => r.json())
      .then((d) => d.pillars && setData(d))
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const api = useCallback(
    async (body, opts = {}) => {
      const res = await fetch("/api/playbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok) {
        load();
        // 18b/18c: explicit edit-saves celebrate; small adds get a quiet toast
        if (opts.celebrate) fb.fireCelebration(opts.celebrate);
        else if (opts.toast) fb.fireToast(opts.toast);
      } else setNotice(d.error || "Something went wrong.");
      return d;
    },
    [load, fb]
  );

  const pillars = data?.pillars || [];
  const contentPillars = pillars.filter((p) => p.key !== "getting_started");
  const gettingStarted = pillars.find((p) => p.key === "getting_started");

  // tab filter for sections shown in a pillar
  const sectionMatchesTab = useCallback(
    (s) => {
      if (tab === "all") return true;
      if (tab === "inspiration") return false; // inspiration shows Getting Started separately
      return (s.neighborhoods || []).includes(tab);
    },
    [tab]
  );

  const openSectionData = useMemo(() => {
    if (!openSection) return null;
    for (const p of pillars) {
      const s = p.sections.find((x) => x.id === openSection);
      if (s) return { ...s, pillar: p };
    }
    return null;
  }, [openSection, pillars]);

  const flatSections = useMemo(
    () => pillars.flatMap((p) => p.sections.map((s) => ({ ...s, pillarName: p.name, pillarEmoji: p.emoji }))),
    [pillars]
  );

  // ---- section detail ----
  if (openSectionData) {
    const s = openSectionData;
    // frozen snapshot — render its tables as event cards (16c/16d)
    const isEventsCalendar = /events calendar/i.test(s.title);
    const asOf = (s.title.match(/as of ([^)]+)/i) || [])[1];

    // delete one event row: strip its exact source line from the block body
    const deleteEventRow = (blk, rowLine) => {
      // stitch first so split rows match row.line, then drop the chosen row
      const body = stitchTableRows(String(blk.body || "").split("\n"))
        .filter((l) => l !== rowLine)
        .join("\n");
      api({ action: "updateBlock", id: blk.id, body });
    };

    return (
      <div className={`${styles.shell} ${styles.pbShell}`}>
        <button className={styles.crmBack} onClick={() => setOpenSection(null)}>‹ The Playbook</button>
        {s.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.pbSectionCover} src={s.coverImage} alt="" />
        )}
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>{s.pillar.emoji} {s.title}</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className={styles.pbTextBtn}
                title="Edit section title & subtitle"
                onClick={() => setEditingId(editingId === `section:${s.id}` ? null : `section:${s.id}`)}
              >
                ✎ Edit
              </button>
              <button
                className={styles.pbDeleteSection}
                title="Delete this whole section"
                onClick={() => {
                  if (confirm(`Delete the entire "${s.title}" section and everything in it? This can't be undone.`)) {
                    api({ action: "deleteSection", id: s.id });
                    setOpenSection(null);
                  }
                }}
              >
                🗑 Delete section
              </button>
            </div>
          </div>
          {isEventsCalendar && asOf && (
            <p className={styles.pbAsOf}>🗓 Frozen snapshot — as of {asOf}. Not your live events feed.</p>
          )}
          {editingId === `section:${s.id}` ? (
            <SectionHeadEditor section={s} onSave={api} onCancel={() => setEditingId(null)} />
          ) : (
            s.subtitle && <p className={styles.pbQuote}>&ldquo;{stripMd(s.subtitle)}&rdquo;</p>
          )}
          {notice && <p className={styles.calNotice}>{notice}</p>}

          {s.blocks.map((blk) => {
            const evTable = isEventsCalendar ? tableFromBody(blk.body) : null;
            return (
            <div key={blk.id} className={styles.pbBlock}>
              <div className={styles.pbBlockHead}>
                <h3>{blk.emoji} {stripMd(blk.heading)}</h3>
                <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                  <button className={styles.pbTinyBtn} title="Edit block" onClick={() => setEditingId(editingId === `block:${blk.id}` ? null : `block:${blk.id}`)}>✎</button>
                  <button className={styles.pbTinyBtn} title="Delete block" onClick={() => { if (confirm("Delete this whole block?")) api({ action: "deleteBlock", id: blk.id }); }}>🗑</button>
                </div>
              </div>

              {editingId === `block:${blk.id}` ? (
                <BlockEditor blk={blk} onSave={api} onCancel={() => setEditingId(null)} />
              ) : evTable ? (
                <div className={styles.pbEventCards}>
                  {evTable.rows.map((row) => {
                    const field = (name) => {
                      const idx = evTable.headers.findIndex((h) => new RegExp(name, "i").test(h));
                      return idx >= 0 ? row.cells[idx] : "";
                    };
                    const pri = priorityMeta(field("priority"));
                    return (
                      <div key={`${blk.id}:${row.line}`} className={styles.pbEventCard}>
                        <div className={styles.pbEventTop}>
                          {pri.dot && <span className={styles.pbEventPri}>{pri.dot} {pri.label}</span>}
                          <span className={styles.pbEventDate}>{stripMd(field("date"))}{field("time") && field("time") !== "—" ? ` · ${stripMd(field("time"))}` : ""}</span>
                          <button className={styles.pbTinyBtn} title="Delete this event" onClick={() => deleteEventRow(blk, row.line)}>✕</button>
                        </div>
                        <div className={styles.pbEventName}>{stripMd(field("event"))}</div>
                        {field("description") && <div className={styles.pbEventDesc}><Markdown>{field("description")}</Markdown></div>}
                      </div>
                    );
                  })}
                  {evTable.remainder && <Markdown>{evTable.remainder}</Markdown>}
                </div>
              ) : (
                <Markdown>{blk.body}</Markdown>
              )}

              {blk.callouts.map((co) => {
                const m = CALLOUT_META[co.type] || CALLOUT_META.NOTE;
                if (editingId === `callout:${co.id}`) {
                  return <CalloutEditor key={co.id} co={co} onSave={api} onCancel={() => setEditingId(null)} />;
                }
                return (
                  <div key={co.id} className={styles.pbCallout} data-type={co.type}>
                    <span className={styles.pbCalloutLabel}>{m.icon} {m.label}</span>
                    <span className={styles.pbCalloutText}>{calloutBody(co.text)}</span>
                    <button className={styles.pbTinyBtn} data-pos="edit" title="Edit idea" onClick={() => setEditingId(`callout:${co.id}`)}>✎</button>
                    <button className={styles.pbTinyBtn} title="Delete idea" onClick={() => api({ action: "deleteCallout", id: co.id })}>✕</button>
                  </div>
                );
              })}
              <IdeaAdder blockId={blk.id} onAdd={api} />
            </div>
            );
          })}

          <BlockAdder sectionId={s.id} onAdd={api} />
        </div>
        {fb.node}
      </div>
    );
  }

  // ---- hub ----
  const shownGettingStarted = tab === "inspiration" || tab === "all";

  return (
    <div className={`${styles.shell} ${styles.pbShell}`}>
      {/* header */}
      <header className={styles.pbHeader}>
        <div>
          <h1 className={styles.pbTitle}>Julie&apos;s Content Playbook 🌿</h1>
          <p className={styles.pbSub}>Plan smarter. Create with purpose. Connect deeper.</p>
        </div>
        <button className={styles.syncBtn} onClick={() => setShowNewIdea(true)}>＋ New Idea</button>
      </header>

      {/* tabs */}
      <div className={styles.pbTabs}>
        {[
          { k: "all", label: "All Playbook" },
          { k: "Fairmount", label: "Fairmount" },
          { k: "Brewerytown", label: "Brewerytown" },
          { k: "inspiration", label: "Inspiration" },
        ].map((t) => (
          <button key={t.k} className={styles.pbTab} data-active={tab === t.k} onClick={() => setTab(t.k)}>{t.label}</button>
        ))}
        <a className={styles.pbExport} href="/admin/playbook/export" target="_blank" rel="noopener noreferrer">⭳ Export</a>
      </div>

      {notice && <p className={styles.calNotice}>{notice}</p>}

      {/* the playbook — pillar cards with REAL counts */}
      {tab !== "inspiration" && (
        <>
          <h2 className={styles.pbSectionTitle}>The Playbook</h2>
          <div className={styles.pbPillarGrid}>
            {contentPillars.map((p) => {
              const sections = p.sections.filter(sectionMatchesTab);
              const ideas = sections.reduce((n, s) => n + s.blocks.reduce((m, b) => m + b.callouts.length, 0), 0);
              return (
                <div key={p.id} className={styles.pbPillarCard}>
                  <div className={styles.pbPillarHead}>{p.emoji} {p.name}</div>
                  {sections.slice(0, 3).map((s) => (
                    <button key={s.id} className={styles.pbPillarLink} onClick={() => setOpenSection(s.id)}>
                      {s.title}
                    </button>
                  ))}
                  {sections.length === 0 && <span className={styles.pbEmptyLink}>No sections for {tab}</span>}
                  <div className={styles.pbCount}>{ideas} Idea{ideas === 1 ? "" : "s"}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* getting started */}
      {shownGettingStarted && gettingStarted && (
        <>
          <h2 className={styles.pbSectionTitle}>Getting Started</h2>
          {gettingStarted.sections.map((s) => (
            <button key={s.id} className={styles.pbStartRow} onClick={() => setOpenSection(s.id)}>
              <div>
                <div className={styles.pbStartTitle}>{s.title}</div>
                {s.subtitle && <div className={styles.pbStartSub}>{stripMd(s.subtitle)}</div>}
              </div>
              <span className={styles.pastChev}>›</span>
            </button>
          ))}
        </>
      )}

      {/* how to use this workspace — static guidance (matches the mockup) */}
      {shownGettingStarted && (
        <div className={styles.pbHowTo}>
          <span className={styles.pbHowToIcon}>⭐</span>
          <div className={styles.pbHowToBody}>
            <strong>How to use this workspace:</strong> Start with Content Philosophy, plan the month with
            {" "}Weekly Content Planner, then pull from the four pillars above.
            {" "}🎉 Check <b>Events</b> every Monday.
          </div>
        </div>
      )}

      {/* neighborhood playbooks */}
      {tab !== "inspiration" && (
        <>
          <h2 className={styles.pbSectionTitle}>Neighborhood Playbooks</h2>
          <div className={styles.pbHoodGrid}>
            {NEIGHBORHOOD_CARDS.map((n) => {
              const ideas = flatSections
                .filter((s) => (s.neighborhoods || []).includes(n.key))
                .reduce((sum, s) => sum + s.blocks.reduce((m, b) => m + b.callouts.length, 0), 0);
              return (
                <button key={n.key} className={styles.pbHoodCard} onClick={() => setTab(n.key)} style={{ backgroundImage: `linear-gradient(rgba(20,14,8,0.15), rgba(20,14,8,0.72)), url(${n.cover})` }}>
                  <div className={styles.pbHoodName}>{n.title}</div>
                  <div className={styles.pbHoodTag}>{n.tagline}</div>
                  <div className={styles.pbHoodCount}>🎉 {ideas} Ideas ›</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {data === null && <p className={styles.calBlurb}>Loading the playbook…</p>}

      {/* new idea composer */}
      {showNewIdea && (
        <NewIdeaModal pillars={pillars} onClose={() => setShowNewIdea(false)} onDone={(msg) => { setShowNewIdea(false); load(); fb.fireCelebration(msg); }} />
      )}

      {/* nav back to admin */}
      <nav className={styles.bottomNav} data-cols="3">
        {/* eslint-disable @next/next/no-img-element */}
        <a className={styles.navItem} href="/admin"><span><img className={styles.navImg} src="/icons/home.png" alt="" /></span>Events</a>
        <a className={styles.navItem} href="/admin/crm"><span><img className={styles.navImg} src="/icons/profile.png" alt="" /></span>CRM</a>
        <button className={styles.navItem} data-active="true"><span><img className={styles.navImg} src="/icons/achievements.png" alt="" /></span>Playbook</button>
        {/* eslint-enable @next/next/no-img-element */}
      </nav>
      {fb.node}
    </div>
  );
}

// inline "add an idea" (callout) to a block
function IdeaAdder({ blockId, onAdd }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("CONTENT_IDEA");
  const [text, setText] = useState("");
  if (!open) return <button className={styles.pbAddIdea} onClick={() => setOpen(true)}>＋ Add idea</button>;
  return (
    <div className={styles.conForm} style={{ marginTop: 8 }}>
      <div className={styles.conFormRow}>
        <select className={styles.authInput} value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(CALLOUT_META).map(([k, m]) => <option key={k} value={k}>{m.icon} {m.label}</option>)}
        </select>
      </div>
      <textarea className={styles.authInput} rows={2} placeholder="Idea text…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className={styles.conFormRow}>
        <button className={styles.syncBtn} onClick={async () => { if (!text.trim()) return; await onAdd({ action: "createCallout", blockId, type, text }, { toast: "Idea added" }); setText(""); setOpen(false); }}>Add</button>
        <button className={styles.conToggle} onClick={() => { setOpen(false); setText(""); }}>Cancel</button>
      </div>
    </div>
  );
}

// inline "add a block" to a section
function BlockAdder({ sectionId, onAdd }) {
  const [open, setOpen] = useState(false);
  const [emoji, setEmoji] = useState("");
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  if (!open) return <button className={styles.pbAddBlock} onClick={() => setOpen(true)}>＋ Add a block</button>;
  return (
    <div className={styles.conForm} style={{ marginTop: 12 }}>
      <div className={styles.conFormRow}>
        <input className={styles.authInput} style={{ flex: "0 0 70px" }} placeholder="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
        <input className={styles.authInput} placeholder="Block heading *" value={heading} onChange={(e) => setHeading(e.target.value)} />
      </div>
      <textarea className={styles.authInput} rows={2} placeholder="Description (optional)" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className={styles.conFormRow}>
        <button className={styles.syncBtn} onClick={async () => { if (!heading.trim()) return; await onAdd({ action: "createBlock", sectionId, emoji, heading, body }, { toast: "Block added" }); setOpen(false); setEmoji(""); setHeading(""); setBody(""); }}>Add block</button>
        <button className={styles.conToggle} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

// 18a — edit an existing block's emoji / heading / body (markdown). Explicit
// Save → celebration (a deliberate "I edited the playbook" moment).
function BlockEditor({ blk, onSave, onCancel }) {
  const [emoji, setEmoji] = useState(blk.emoji || "");
  const [heading, setHeading] = useState(blk.heading || "");
  const [body, setBody] = useState(blk.body || "");
  return (
    <div className={styles.conForm} style={{ marginTop: 8 }}>
      <div className={styles.conFormRow}>
        <input className={styles.authInput} style={{ flex: "0 0 70px" }} placeholder="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
        <input className={styles.authInput} placeholder="Heading *" value={heading} onChange={(e) => setHeading(e.target.value)} />
      </div>
      <textarea className={styles.authInput} rows={6} placeholder="Body (markdown — tables & lists supported)" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className={styles.conFormRow}>
        <button className={styles.syncBtn} onClick={async () => { if (!heading.trim()) return; await onSave({ action: "updateBlock", id: blk.id, emoji, heading, body }, { celebrate: "Playbook saved!" }); onCancel(); }}>Save</button>
        <button className={styles.conToggle} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// 18a — edit an existing callout ("idea") type + text.
function CalloutEditor({ co, onSave, onCancel }) {
  const [type, setType] = useState(co.type);
  const [text, setText] = useState(co.text || "");
  return (
    <div className={styles.conForm} style={{ marginTop: 6 }}>
      <div className={styles.conFormRow}>
        <select className={styles.authInput} value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(CALLOUT_META).map(([k, m]) => <option key={k} value={k}>{m.icon} {m.label}</option>)}
        </select>
      </div>
      <textarea className={styles.authInput} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      <div className={styles.conFormRow}>
        <button className={styles.syncBtn} onClick={async () => { if (!text.trim()) return; await onSave({ action: "updateCallout", id: co.id, type, text }, { celebrate: "Idea saved!" }); onCancel(); }}>Save</button>
        <button className={styles.conToggle} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// 18a — edit a section's title + subtitle.
function SectionHeadEditor({ section, onSave, onCancel }) {
  const [title, setTitle] = useState(section.title || "");
  const [subtitle, setSubtitle] = useState(section.subtitle || "");
  return (
    <div className={styles.conForm} style={{ marginTop: 8 }}>
      <input className={styles.authInput} placeholder="Section title *" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={styles.authInput} placeholder="Subtitle / tagline" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
      <div className={styles.conFormRow}>
        <button className={styles.syncBtn} onClick={async () => { if (!title.trim()) return; await onSave({ action: "updateSection", id: section.id, title, subtitle }, { celebrate: "Section saved!" }); onCancel(); }}>Save</button>
        <button className={styles.conToggle} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// "+ New Idea" — create a section (a new card) or add an idea to an existing one
function NewIdeaModal({ pillars, onClose, onDone }) {
  const [mode, setMode] = useState("section"); // section | idea
  const [pillarId, setPillarId] = useState(pillars.find((p) => p.key !== "getting_started")?.id || pillars[0]?.id || "");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [type, setType] = useState("CONTENT_IDEA");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const sections = pillars.flatMap((p) => p.sections.map((s) => ({ id: s.id, label: `${p.emoji} ${s.title}`, blockId: s.blocks[0]?.id })));

  async function submit() {
    setBusy(true);
    if (mode === "section") {
      const res = await fetch("/api/playbook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createSection", pillarId, title, subtitle }) });
      const d = await res.json();
      setBusy(false);
      if (res.ok) onDone(`New section added!`);
    } else {
      const sec = sections.find((s) => s.id === sectionId);
      if (!sec?.blockId) { setBusy(false); return; }
      const res = await fetch("/api/playbook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createCallout", blockId: sec.blockId, type, text }) });
      setBusy(false);
      if (res.ok) onDone("Idea added!");
    }
  }

  return (
    <div className={styles.drawerScrim} onClick={onClose}>
      <div className={styles.pbModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.panelHead}>
          <h2>＋ New Idea</h2>
          <button className={styles.notifClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.pbTabs} style={{ marginBottom: 12 }}>
          <button className={styles.pbTab} data-active={mode === "section"} onClick={() => setMode("section")}>New section</button>
          <button className={styles.pbTab} data-active={mode === "idea"} onClick={() => setMode("idea")}>Quick idea</button>
        </div>
        {mode === "section" ? (
          <div className={styles.conForm}>
            <select className={styles.authInput} value={pillarId} onChange={(e) => setPillarId(e.target.value)}>
              {pillars.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
            </select>
            <input className={styles.authInput} placeholder="Section title *" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className={styles.authInput} placeholder="Subtitle / quote (optional)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            <button className={styles.syncBtn} disabled={busy || !title.trim()} onClick={submit}>{busy ? "Adding…" : "Add section"}</button>
          </div>
        ) : (
          <div className={styles.conForm}>
            <select className={styles.authInput} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Choose a section…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select className={styles.authInput} value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(CALLOUT_META).map(([k, m]) => <option key={k} value={k}>{m.icon} {m.label}</option>)}
            </select>
            <textarea className={styles.authInput} rows={3} placeholder="Idea text…" value={text} onChange={(e) => setText(e.target.value)} />
            <button className={styles.syncBtn} disabled={busy || !sectionId || !text.trim()} onClick={submit}>{busy ? "Adding…" : "Add idea"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
