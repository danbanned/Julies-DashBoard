"use client";

// Julie's Events console (12e) — engagement per event, Most Views sort,
// suggest/hide toggles, content-idea tags, drafts, Add New Event, Content
// Theme Performance (12h), and Family Group Chat posting (12i).
// Every number is real tracked data or an honest zero.
import { useMemo, useState } from "react";
import styles from "../app/Events.module.css";

function fmtK(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

export default function AdminConsole({ data }) {
  const [meta, setMeta] = useState(data.meta || {});
  const [tab, setTab] = useState("all"); // all | suggested | drafts
  const [sort, setSort] = useState("date"); // date | views
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState(data.events.filter((e) => e._draft));
  const [addForm, setAddForm] = useState({ title: "", startDate: "", endDate: "", location: "", neighborhood: "", eventUrl: "", description: "" });

  const counts = data.counts || {};
  const ideas = data.ideas || [];
  const published = data.events.filter((e) => !e._draft);

  const patchMeta = (eventId, patch) => {
    setMeta((prev) => ({ ...prev, [eventId]: { eventId, ...prev[eventId], ...patch } }));
    fetch("/api/admin/event-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, ...patch }),
    }).catch(() => {});
  };

  const rows = useMemo(() => {
    let list = tab === "drafts" ? drafts : published;
    if (tab === "suggested") list = list.filter((e) => meta[e.id]?.suggested);
    if (sort === "views") {
      list = [...list].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    }
    return list.slice(0, 80);
  }, [tab, sort, published, drafts, meta, counts]);

  const suggestedCount = Object.values(meta).filter((m) => m.suggested).length;

  // 12h: real theme performance — views aggregated by attached content idea
  const themePerf = useMemo(() => {
    const sums = {};
    for (const [eventId, m] of Object.entries(meta)) {
      if (m.contentIdeaKey) {
        sums[m.contentIdeaKey] = (sums[m.contentIdeaKey] || 0) + (counts[eventId] || 0);
      }
    }
    const list = ideas
      .map((i) => ({ ...i, views: sums[i.key] || 0 }))
      .filter((i) => i.views > 0)
      .sort((a, b) => b.views - a.views);
    return { list, max: list[0]?.views || 1 };
  }, [meta, counts, ideas]);

  async function addEvent(publish) {
    if (!addForm.title || !/^\d{4}-\d{2}-\d{2}$/.test(addForm.startDate)) {
      setNotice("A title and start date (YYYY-MM-DD) are required.");
      return;
    }
    const res = await fetch("/api/admin/manual-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addForm, published: publish }),
    });
    const d = await res.json();
    if (!res.ok) {
      setNotice(d.error || "Couldn't save the event.");
      return;
    }
    setNotice(publish ? "✅ Event published to the viewer feed." : "✅ Saved as draft.");
    if (!publish) setDrafts((prev) => [{ id: `manual-${d.event.id}`, _manualId: d.event.id, title: d.event.title, start_date: d.event.startDate, _draft: true, neighborhood: d.event.neighborhood || "Other", location: d.event.location || "" }, ...prev]);
    setAddForm({ title: "", startDate: "", endDate: "", location: "", neighborhood: "", eventUrl: "", description: "" });
    setShowAdd(false);
  }

  async function publishDraft(row) {
    await fetch("/api/admin/manual-event", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row._manualId, published: true }),
    });
    setDrafts((prev) => prev.filter((d) => d.id !== row.id));
    setNotice(`✅ "${row.title}" published — it's on the viewer feed now.`);
  }

  return (
    <div>
      {/* metric cards — real or zero, never fabricated */}
      <div className={styles.conMetrics}>
        <div className={styles.conMetric}><span>👁 Total Views</span><b>{fmtK(data.totals.views)}</b><em>all time</em></div>
        <div className={styles.conMetric}><span>💛 Engagement</span><b>{fmtK(data.totals.weekViews)}</b><em>views this week</em></div>
        <div className={styles.conMetric}><span>📅 Events</span><b>{data.totals.eventCount}</b><em>live on viewer side</em></div>
        <div className={styles.conMetric}><span>📌 Suggested</span><b>{suggestedCount}</b><em>in Julie&apos;s Picks</em></div>
      </div>

      {notice && <p className={styles.calNotice}>{notice}</p>}

      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>＋ Add & Manage Events</h2>
          <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort console">
            <option value="date">By date</option>
            <option value="views">Most Views</option>
          </select>
        </div>
        <div className={styles.profileTabs}>
          <button className={styles.profileTab} data-active={tab === "all"} onClick={() => setTab("all")}>All Events</button>
          <button className={styles.profileTab} data-active={tab === "suggested"} onClick={() => setTab("suggested")}>Suggested</button>
          <button className={styles.profileTab} data-active={tab === "drafts"} onClick={() => setTab("drafts")}>Drafts ({drafts.length})</button>
        </div>

        <div className={styles.conList}>
          {rows.length === 0 && (
            <div className={styles.empty}>
              <h3>{tab === "drafts" ? "No drafts" : tab === "suggested" ? "Nothing suggested yet" : "No events"}</h3>
              <p>{tab === "suggested" ? "Toggle ⭐ Suggest on any event to feature it in Julie's Picks." : "Use “Add New Event” below."}</p>
            </div>
          )}
          {rows.map((ev) => {
            const m = meta[ev.id] || {};
            return (
              <div key={ev.id} className={styles.conRow} data-hidden={m.hidden}>
                <div className={styles.conInfo}>
                  <div className={styles.conTitle}>{ev.title}</div>
                  <div className={styles.conMeta}>
                    {ev.start_date}
                    {ev.neighborhood && ev.neighborhood !== "Other" ? ` · ${ev.neighborhood}` : ""}
                    {" · "}
                    <b>{counts[ev.id] || 0} views</b>
                    {ev._draft && " · DRAFT"}
                  </div>
                  <select
                    className={styles.conIdea}
                    value={m.contentIdeaKey || ""}
                    onChange={(e) => patchMeta(ev.id, { contentIdeaKey: e.target.value || null })}
                    aria-label="Content idea"
                  >
                    <option value="">— content idea —</option>
                    {ideas.map((i) => (
                      <option key={i.key} value={i.key}>{i.emoji} {i.title}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.conActions}>
                  {ev._draft ? (
                    <button className={styles.syncBtn} onClick={() => publishDraft(ev)}>Publish</button>
                  ) : (
                    <>
                      <button className={styles.conToggle} data-on={Boolean(m.suggested)} onClick={() => patchMeta(ev.id, { suggested: !m.suggested })} title="Feature in Julie's Picks">
                        ⭐ {m.suggested ? "Suggested" : "Suggest"}
                      </button>
                      <button className={styles.conToggle} data-on={Boolean(m.hidden)} onClick={() => patchMeta(ev.id, { hidden: !m.hidden })} title="Hide from the viewer feed">
                        {m.hidden ? "🙈 Hidden" : "👁 Hide"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button className={styles.mapBtn} style={{ marginTop: 12 }} onClick={() => setShowAdd((v) => !v)}>
          ＋ Add New Event
        </button>
        {showAdd && (
          <div className={styles.conForm}>
            <input className={styles.authInput} placeholder="Title *" value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} />
            <div className={styles.conFormRow}>
              <input className={styles.authInput} placeholder="Start (YYYY-MM-DD) *" value={addForm.startDate} onChange={(e) => setAddForm({ ...addForm, startDate: e.target.value })} />
              <input className={styles.authInput} placeholder="End (optional)" value={addForm.endDate} onChange={(e) => setAddForm({ ...addForm, endDate: e.target.value })} />
            </div>
            <div className={styles.conFormRow}>
              <input className={styles.authInput} placeholder="Location" value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} />
              <input className={styles.authInput} placeholder="Neighborhood" value={addForm.neighborhood} onChange={(e) => setAddForm({ ...addForm, neighborhood: e.target.value })} />
            </div>
            <input className={styles.authInput} placeholder="Event link (https://…)" value={addForm.eventUrl} onChange={(e) => setAddForm({ ...addForm, eventUrl: e.target.value })} />
            <textarea className={styles.authInput} rows={3} placeholder="Description" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} />
            <div className={styles.conFormRow}>
              <button className={styles.syncBtn} onClick={() => addEvent(true)}>Publish now</button>
              <button className={styles.conToggle} onClick={() => addEvent(false)}>Save as draft</button>
            </div>
          </div>
        )}
      </div>

      {/* 12h content theme performance — REAL aggregated views */}
      <div className={styles.panel}>
        <div className={styles.panelHead}><h2>📊 Content Theme Performance</h2></div>
        {themePerf.list.length === 0 ? (
          <div className={styles.empty}>
            <h3>No theme data yet</h3>
            <p>Attach content ideas to events above — viewer clicks will build this chart.</p>
          </div>
        ) : (
          <div className={styles.perfList}>
            {themePerf.list.map((t) => (
              <div key={t.key} className={styles.perfRow}>
                <span className={styles.perfLabel}>{t.emoji} {t.title}</span>
                <div className={styles.perfTrack}>
                  <div className={styles.perfFill} style={{ width: `${(t.views / themePerf.max) * 100}%` }} />
                </div>
                <span className={styles.perfCount}>{fmtK(t.views)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
