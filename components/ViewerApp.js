"use client";

// PUBLIC viewer experience (Phase 12c, corrected):
// - HOME: hero photo, filters, Events Near You map, Julie's Picks, content
//   ideas, dated feed, save banner (anonymous).
// - EVENTS (signed-in only): dedicated browser — search, sort, category +
//   tag filters, scrollable list. No map, no hero CTA, no featured sections.
// - CALENDAR (signed-in only): the events they added, month grid.
// - Nav: anonymous = Home/Favorites/Profile; signed-in adds Events + Calendar.
// Every number shown is real tracked data; distance is a wired placeholder
// ("— mi") until geolocation exists — never a fabricated figure.

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import styles from "../app/Events.module.css";
import EventsMap, { hasMapsKey } from "./EventsMap";
import CalendarView from "./CalendarView";

function fmtViews(n) {
  if (!n) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K views`;
  return `${n} view${n === 1 ? "" : "s"}`;
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    mo: dt.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: String(d),
    dow: dt.toLocaleString("en-US", { weekday: "short" }).toUpperCase(),
  };
}

function fmtTime(t) {
  if (!t) return "";
  t = String(t);
  if (t.includes("T")) t = t.split("T")[1];
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

function rangeWindows() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = today.getDay();
  const sat = new Date(today);
  sat.setDate(today.getDate() + (dow === 0 ? -1 : 6 - dow));
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + ((7 - dow) % 7));
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    weekend: [toISO(sat), toISO(sun)],
    week: [toISO(today), toISO(weekEnd)],
    month: [toISO(new Date(today.getFullYear(), today.getMonth(), 1)), toISO(monthEnd)],
  };
}

const RANGES = [
  { key: "all", label: "All dates" },
  { key: "weekend", label: "This Weekend" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

const AREAS = ["All Areas", "Fairmount", "Brewerytown", "University City"];

function overlaps(ev, [a, b]) {
  const end = ev.end_date || ev.start_date;
  return ev.start_date <= b && end >= a;
}

const CAT_EMOJI = {
  Music: "🎵 ",
  "Arts & Theatre": "🎭 ",
  Festival: "🎪 ",
  Exhibition: "🖼 ",
  Sports: "⚽ ",
  Community: "🐾 ",
  "Food & Drink": "🍷 ",
  Outdoors: "🌲 ",
};

function catEmoji(c) {
  return CAT_EMOJI[c] || "";
}

function realCategory(ev) {
  const c = String(ev.category || "").trim();
  return c && !/^undefined$/i.test(c) ? c : null;
}

function tagsFor(ev) {
  const t = [];
  const c = realCategory(ev);
  if (c) t.push(c);
  if (ev.neighborhood && ev.neighborhood !== "Other") t.push(ev.neighborhood);
  if (/free|^\$?0$/i.test(String(ev.fee || "").trim())) t.push("Free");
  if (/dog|pup/i.test(ev.description || "")) t.push("Dog Friendly");
  if (/family|kid/i.test(ev.description || "")) t.push("Family Friendly");
  return [...new Set(t)].slice(0, 4);
}

function ViewerCard({ ev, count, row, act, user, onOpen, onTag, activeTags }) {
  const { mo, day, dow } = fmtDate(ev.start_date);
  const time = fmtTime(ev.start_time);
  const badge = fmtViews(count);
  const tags = tagsFor(ev);
  const Wrapper = ev.event_url ? "a" : "div";
  const wrapperProps = ev.event_url
    ? { href: ev.event_url, target: "_blank", rel: "noopener noreferrer", onClick: () => onOpen(ev) }
    : { onClick: () => onOpen(ev) };

  const actBtn = (action, on, icon, label) => (
    <button
      className={styles.wActBtn}
      data-on={Boolean(on)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        act(ev, action, !on);
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  );

  return (
    <div className={styles.wCard}>
      <Wrapper className={styles.wMain} {...wrapperProps}>
        <div className={styles.wThumb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ev.image_url} alt="" loading="lazy" />
          {badge && <span className={styles.vViews}>👁 {badge}</span>}
        </div>
        <div className={styles.wDateBlock}>
          <span>{mo}</span>
          <b>{day}</b>
          <span>{dow}</span>
        </div>
        <div className={styles.wBody}>
          <div className={styles.wTopRow}>
            {(ev.priority === "high" || ev.priority === "medium") && (
              <span className={styles.wPriority} data-p={ev.priority}>
                {ev.priority} priority
              </span>
            )}
            <span className={styles.wDistance}>{ev.distance || "— mi"} 🚶</span>
          </div>
          <div className={styles.wTitle}>{ev.title}</div>
          <div className={styles.wMeta}>
            {ev.location}
            {time ? ` · ${time}` : ""}
          </div>
          {ev.description && <div className={styles.wDesc}>{ev.description}</div>}
          {tags.length > 0 && (
            <div className={styles.wTags}>
              {tags.map((t) => (
                <button
                  key={t}
                  className={styles.tag}
                  data-active={activeTags?.has(t)}
                  title={`Filter by "${t}"`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTag?.(t);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </Wrapper>
      <div className={styles.wActions}>
        {actBtn("saved", row?.saved, "🔖", row?.saved ? "Saved" : "Save")}
        {actBtn("liked", row?.liked, row?.liked ? "♥" : "♡", row?.liked ? "Liked" : "Like")}
        {actBtn("calendar", row?.addedToCalendar, "📅", row?.addedToCalendar ? "Added" : "Add")}
      </div>
    </div>
  );
}

export default function ViewerApp({ events, suggestedIds, ideas, ideaKeyByEvent, counts, user }) {
  const [sort, setSort] = useState("soonest");
  const [showDates, setShowDates] = useState(false);
  const [range, setRange] = useState("all");
  const [area, setArea] = useState("All Areas");
  const [ideaFilter, setIdeaFilter] = useState(null);
  const [view, setView] = useState("home"); 
  const [menuOpen, setMenuOpen] = useState(false);
  const [inter, setInter] = useState({});
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [tagSel, setTagSel] = useState(new Set());
  const [evSort, setEvSort] = useState("soonest");
  const [evShowDates, setEvShowDates] = useState(false);
  const [evRange, setEvRange] = useState("all");

  const windows = useMemo(() => rangeWindows(), []);
  const todayIso = useMemo(() => toISO(new Date()), []);

  const refreshInteractions = useCallback(() => {
    if (!user) return;
    fetch("/api/interactions")
      .then((r) => r.json())
      .then((d) => {
        const m = {};
        for (const row of d.interactions || []) m[row.eventId] = row;
        setInter(m);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => { refreshInteractions(); }, [refreshInteractions]);

  const track = useCallback((ev) => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ eventId: ev.id }),
    }).catch(() => {});
  }, []);

  const act = useCallback(
    (ev, action, value) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const flag = { saved: "saved", liked: "liked", calendar: "addedToCalendar" }[action];
      setInter((prev) => ({
        ...prev,
        [ev.id]: { eventId: ev.id, ...prev[ev.id], [flag]: value },
      }));
      fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: ev.id,
          action,
          value,
          snapshot: {
            title: ev.title,
            start_date: ev.start_date,
            end_date: ev.end_date,
            event_url: ev.event_url,
            location: ev.location,
            neighborhood: ev.neighborhood,
            source: ev.source,
          },
        }),
      })
        .then((r) => r.json())
        .then((d) => d.interaction && setInter((p) => ({ ...p, [d.interaction.eventId]: d.interaction })))
        .catch(() => {});
    },
    [user]
  );

  const picks = useMemo(() => events.filter((e) => suggestedIds.includes(e.id)), [events, suggestedIds]);

  // one tag filter shared by every list — card tag chips toggle it too
  const toggleTag = useCallback((t) => {
    setTagSel((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }, []);
  const matchesTags = useCallback(
    (e) => tagSel.size === 0 || [...tagSel].every((s) => tagsFor(e).includes(s)),
    [tagSel]
  );

  const splitOngoing = useCallback(
    (list, sortMode) => {
      const on = [];
      const up = [];
      for (const e of list) {
        (e.start_date < todayIso && (e.end_date || e.start_date) >= todayIso ? on : up).push(e);
      }
      on.sort((a, b) => a.start_date.localeCompare(b.start_date));
      if (sortMode === "newest") {
        up.sort(
          (a, b) =>
            String(b.ingested_at || "").localeCompare(String(a.ingested_at || "")) ||
            a.start_date.localeCompare(b.start_date)
        );
      } else {
        up.sort((a, b) => a.start_date.localeCompare(b.start_date));
      }
      return { ongoing: on, upcoming: up };
    },
    [todayIso]
  );

  const homeFeed = useMemo(() => {
    let list = events;
    if (area !== "All Areas") list = list.filter((e) => e.neighborhood === area);
    if (ideaFilter) list = list.filter((e) => ideaKeyByEvent[e.id] === ideaFilter);
    if (range !== "all") list = list.filter((e) => overlaps(e, windows[range]));
    list = list.filter(matchesTags); // card tag chips filter the home feed too
    return splitOngoing(list, sort);
  }, [events, area, ideaFilter, range, windows, sort, ideaKeyByEvent, splitOngoing, matchesTags]);

  const categories = useMemo(() => {
    const freq = {};
    for (const e of events) {
      const c = realCategory(e);
      if (c) freq[c] = (freq[c] || 0) + 1;
    }
    return ["All", ...Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k)];
  }, [events]);

  const allTags = useMemo(() => {
    const freq = {};
    for (const e of events) for (const t of tagsFor(e)) freq[t] = (freq[t] || 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  }, [events]);

  const eventsPageList = useMemo(() => {
    let list = events;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) => `${e.title} ${e.description} ${e.location}`.toLowerCase().includes(q));
    if (cat !== "All") list = list.filter((e) => realCategory(e) === cat);
    list = list.filter(matchesTags);
    if (evRange !== "all") list = list.filter((e) => overlaps(e, windows[evRange]));
    return splitOngoing(list, evSort);
  }, [events, query, cat, evSort, evRange, windows, splitOngoing, matchesTags]);

  const mapPoints = useMemo(
    () => events.filter((e) => e.lat != null).map((e) => ({ lat: e.lat, lng: e.lng, exact: e.geoExact, title: e.title })),
    [events]
  );

  const savedEvents = events.filter((e) => inter[e.id]?.saved);
  const card = (ev) => (
    <ViewerCard
      key={ev.id}
      ev={ev}
      count={counts[ev.id]}
      row={inter[ev.id]}
      act={act}
      user={user}
      onOpen={track}
      onTag={toggleTag}
      activeTags={tagSel}
    />
  );

  return (
    <div className={styles.shell}>
      {/* header band */}
      {/* eslint-disable @next/next/no-img-element */}
      <header className={styles.vHeader}>
        <button className={styles.iconBtn} aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <img className={styles.iconImg} src="/icons/menu.png" alt="" />
        </button>
        <div className={styles.vHeadCenter}>
          <span className={styles.vLogo}>Julie&apos;s Event</span>
          {user ? (
            <span className={styles.vGreeting}>Hi, {user.name?.split(" ")[0] || "friend"} 🤍</span>
          ) : (
            <a className={styles.vGreetingLink} href="/login">Sign in · it&apos;s free</a>
          )}
        </div>
        <a className={styles.iconBtn} aria-label="Community updates" href="/chat" title="Family Group Chat">
          <img className={styles.iconImg} src="/icons/bell.png" alt="" />
        </a>
      </header>
      {/* eslint-enable @next/next/no-img-element */}

      {menuOpen && (
        <div className={styles.drawerScrim} onClick={() => setMenuOpen(false)}>
          <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHead}>
              <h3>Menu</h3>
              <button className={styles.iconBtn} aria-label="Close menu" onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <a className={styles.drawerLink} href="/chat">💬 Family Group Chat</a>
            {user?.role === "ADMIN" && <a className={styles.drawerLink} href="/admin">🗂 Admin dashboard</a>}
            {user ? (
              <button className={styles.drawerLink} onClick={() => signOut({ callbackUrl: "/" })}>👋 Sign out</button>
            ) : (
              <a className={styles.drawerLink} href="/login">👤 Sign in / create account</a>
            )}
            <h4>About App</h4>
            <p>
              Julie&apos;s Event surfaces the best of Philadelphia — Fairmount,
              Brewerytown and beyond. Local events, curated by Julie, synced
              fresh every morning.
            </p>
            <p className={styles.credits}>
              <a target="_blank" rel="noopener noreferrer" href="https://icons8.com/icon/pVlzUsxgdINd/camper">Camper</a>
              {" "}icon by{" "}
              <a target="_blank" rel="noopener noreferrer" href="https://icons8.com">Icons8</a>
            </p>
          </aside>
        </div>
      )}

      {/* Structured Content Area to completely mitigate component gaps */}
      <main className={styles.shellContent}>
        {/* ================= HOME ================= */}
        {view === "home" && (
          <div className={styles.viewContainer}>
            <section className={styles.vPhotoHero}>
              <div className={styles.vPhotoInner}>
                <h1 className={styles.vPhotoTitle}>Discover the best of Philadelphia</h1>
                <p className={styles.vPhotoSub}>Local events. Curated by Julie.</p>
                <button
                  className={styles.vExplore}
                  onClick={() => document.getElementById("viewer-feed")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Explore Events
                </button>
              </div>
            </section>

            <div className={styles.vFilters}>
              <button className={styles.vPill} data-active={sort === "soonest" && !showDates} onClick={() => { setSort("soonest"); setShowDates(false); setRange("all"); }}>📅 Soonest</button>
              <button className={styles.vPill} data-active={showDates} onClick={() => setShowDates((v) => !v)}>🗓 Dates</button>
              <button className={styles.vPill} data-active={sort === "newest"} onClick={() => { setSort("newest"); setShowDates(false); }}>✨ Newest</button>
            </div>
            
            {showDates && (
              <div className={styles.subRow}>
                {RANGES.map((r) => (
                  <button key={r.key} className={styles.subChip} data-active={range === r.key} onClick={() => setRange(r.key)}>{r.label}</button>
                ))}
              </div>
            )}
            
            <div className={styles.subRow}>
              {AREAS.map((a) => (
                <button key={a} className={styles.subChip} data-active={area === a} onClick={() => setArea(a)}>
                  {a === "All Areas" ? "📍 " : ""}{a}
                </button>
              ))}
            </div>

            {hasMapsKey && (
              <section className={styles.panel}>
                <div className={styles.panelHead}><h2>📍 Events Near You</h2></div>
                <EventsMap points={mapPoints} className={styles.mapCanvas} />
              </section>
            )}

            {picks.length > 0 && (
              <section className={styles.panel}>
                <div className={styles.panelHead}><h2>⭐ Julie&apos;s Picks For You</h2></div>
                <p className={styles.calBlurb}>Events and experiences you&apos;ll love.</p>
                <div className={styles.list}>{picks.map(card)}</div>
              </section>
            )}

            {ideas.length > 0 && (
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2>💡 Julie&apos;s Content Ideas</h2>
                  {ideaFilter && (
                    <button className={styles.seeAll} onClick={() => setIdeaFilter(null)}>Clear filter ✕</button>
                  )}
                </div>
                <div className={styles.ideaRow}>
                  {ideas.map((idea) => (
                    <button key={idea.key} className={styles.ideaCard} data-active={ideaFilter === idea.key} onClick={() => setIdeaFilter(ideaFilter === idea.key ? null : idea.key)}>
                      <span className={styles.ideaEmoji}>{idea.emoji}</span>
                      <span className={styles.ideaTitle}>{idea.title}</span>
                      <span className={styles.ideaBlurb}>{idea.blurb}</span>
                      <span className={styles.ideaSee}>See all →</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {tagSel.size > 0 && (
              <div className={styles.subRow}>
                <span className={styles.tagLabel}>Filtering by</span>
                {[...tagSel].map((t) => (
                  <button key={t} className={styles.subChip} data-active="true" onClick={() => toggleTag(t)}>
                    {t} ✕
                  </button>
                ))}
                <button className={styles.subChip} onClick={() => setTagSel(new Set())}><u>Clear</u></button>
              </div>
            )}

            <section className={styles.panel} id="viewer-feed">
              <div className={styles.panelHead}>
                <h2>🎟 Upcoming Events</h2>
                <span className={styles.pastCount}>{homeFeed.upcoming.length}</span>
              </div>
              {homeFeed.upcoming.length === 0 ? (
                <div className={styles.empty}>
                  <h3>No events match</h3>
                  <p>Try a different date range, area, or clear the tag filter.</p>
                </div>
              ) : (
                <div className={styles.scrollBox} data-kind="upcoming">
                  <div className={styles.list}>
                    {homeFeed.upcoming.map(card)}
                  </div>
                </div>
              )}
            </section>

            {homeFeed.ongoing.length > 0 && (
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2>🔵 Ongoing Events</h2>
                  <span className={styles.pastCount}>{homeFeed.ongoing.length}</span>
                </div>
                <div className={styles.scrollBox} data-kind="ongoing">
                  <div className={styles.list}>
                    {homeFeed.ongoing.map(card)}
                  </div>
                </div>
              </section>
            )}

            {!user && (
              <section className={styles.saveBanner}>
                <span className={styles.saveBannerHeart}>♥</span>
                <div className={styles.saveBannerText}>
                  <b>Save your favorites</b>
                  <span>Sign in to keep your saved events across devices.</span>
                </div>
                <a className={styles.vExplore} href="/login">Sign in</a>
              </section>
            )}
          </div>
        )}

        {/* ================= EVENTS (signed-in browser) ================= */}
        {view === "events" && user && (
          <div className={styles.viewContainer}>
            <section className={styles.evHero}>
              <div className={styles.evHeroInner}>
                <h1>All Events</h1>
                <p>Find something to do. Make memories.</p>
                <div className={styles.evPills}>
                  <button className={styles.evPill} data-active={evSort === "soonest" && !evShowDates} onClick={() => { setEvSort("soonest"); setEvShowDates(false); setEvRange("all"); }}>
                    📅 Soonest
                  </button>
                  <button className={styles.evPill} data-active={evShowDates} onClick={() => setEvShowDates((v) => !v)}>
                    🗓 Dates
                  </button>
                  <button className={styles.evPill} data-active={evSort === "newest"} onClick={() => { setEvSort("newest"); setEvShowDates(false); }}>
                    ✨ Newest
                  </button>
                </div>
              </div>
            </section>

            {evShowDates && (
              <div className={styles.subRow}>
                {RANGES.map((r) => (
                  <button key={r.key} className={styles.subChip} data-active={evRange === r.key} onClick={() => setEvRange(r.key)}>{r.label}</button>
                ))}
              </div>
            )}

            <div className={styles.subRow}>
              {categories.map((c) => (
                <button key={c} className={styles.subChip} data-active={cat === c} onClick={() => setCat(c)}>
                  {catEmoji(c)}{c}
                </button>
              ))}
            </div>

            <div className={styles.subRow}>
              <span className={styles.tagLabel}>Filter by tag</span>
              {allTags.map((t) => (
                <button
                  key={t}
                  className={styles.subChip}
                  data-active={tagSel.has(t)}
                  onClick={() =>
                    setTagSel((prev) => {
                      const next = new Set(prev);
                      next.has(t) ? next.delete(t) : next.add(t);
                      return next;
                    })
                  }
                >
                  {t}
                </button>
              ))}
              {tagSel.size > 0 && (
                <button className={styles.subChip} onClick={() => setTagSel(new Set())}><u>Clear</u></button>
              )}
            </div>

            <input
              className={styles.vSearch}
              placeholder="Search events…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

              {/* the Events page renders ITS OWN filtered list (search +
                  category + tags + dates) — Upcoming first, then Ongoing */}
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2>🎟 Upcoming Events</h2>
                  <span className={styles.pastCount}>{eventsPageList.upcoming.length}</span>
                </div>
                {eventsPageList.upcoming.length === 0 ? (
                  <div className={styles.empty}>
                    <h3>Nothing matches</h3>
                    <p>Loosen the search or clear some tags.</p>
                  </div>
                ) : (
                  <div className={styles.scrollBox} data-kind="upcoming">
                    <div className={styles.list}>
                      {eventsPageList.upcoming.map(card)}
                    </div>
                  </div>
                )}
              </section>

              {eventsPageList.ongoing.length > 0 && (
                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <h2>🔵 Ongoing Events</h2>
                    <span className={styles.pastCount}>{eventsPageList.ongoing.length}</span>
                  </div>
                  <div className={styles.scrollBox} data-kind="ongoing">
                    <div className={styles.list}>
                      {eventsPageList.ongoing.map(card)}
                    </div>
                  </div>
                </section>
              )}
          </div>
        )}

        {/* ================= CALENDAR (signed-in) ================= */}
        {view === "calendar" && user && (
          <div className={styles.viewContainer}>
            <CalendarView interactions={inter} refresh={refreshInteractions} showGoogle={false} />
          </div>
        )}

        {/* ================= FAVORITES ================= */}
        {view === "favorites" && (
          <div className={styles.viewContainer}>
            <section className={styles.panel}>
              <div className={styles.panelHead}><h2>♥ Favorites</h2></div>
              {!user ? (
                <div className={styles.empty}>
                  <h3>Sign in to save events</h3>
                  <p><a href="/login" className={styles.vChatLink}>Create a free account</a> to keep your favorites.</p>
                </div>
              ) : savedEvents.length === 0 ? (
                <div className={styles.empty}>
                  <h3>No favorites yet</h3>
                  <p>Tap 🔖 Save on any event to keep it here.</p>
                </div>
              ) : (
                <div className={styles.list}>{savedEvents.map(card)}</div>
              )}
            </section>
          </div>
        )}

        {/* ================= PROFILE ================= */}
        {view === "profile" && (
          <div className={styles.viewContainer}>
            <section className={styles.panel}>
              <div className={styles.panelHead}><h2>👤 Profile</h2></div>
              {user ? (
                <div className={styles.empty}>
                  <h3>{user.name}</h3>
                  <p>You&apos;re signed in{user.role === "ADMIN" ? " as admin" : ""}.</p>
                  {user.role === "ADMIN" && (
                    <p><a className={styles.vChatLink} href="/admin">→ Open your admin dashboard</a></p>
                  )}
                  <button className={styles.vExplore} style={{ marginTop: 14 }} onClick={() => signOut({ callbackUrl: "/" })}>
                    Sign out
                  </button>
                </div>
              ) : (
                <div className={styles.empty}>
                  <h3>Browse freely</h3>
                  <p>No account needed to explore. Sign in to save favorites.</p>
                  <p style={{ marginTop: 10 }}><a className={styles.vChatLink} href="/login">Sign in / create account</a></p>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Nav */}
      <nav className={styles.bottomNav} data-cols={user ? 5 : 3}>
        {/* eslint-disable @next/next/no-img-element */}
        <button className={styles.navItem} data-active={view === "home"} onClick={() => { setView("home"); window.scrollTo({ top: 0 }); }}>
          <span><img className={styles.navImg} src="/icons/home.png" alt="" /></span>Home
        </button>
        {user && (
          <button className={styles.navItem} data-active={view === "events"} onClick={() => { setView("events"); window.scrollTo({ top: 0 }); }}>
            <span><img className={styles.navImg} src="/icons/events.png" alt="" /></span>Events
          </button>
        )}
        {user && (
          <button className={styles.navItem} data-active={view === "calendar"} onClick={() => setView("calendar")}>
            <span><img className={styles.navImg} src="/icons/calendar.png" alt="" /></span>Calendar
          </button>
        )}
        <button className={styles.navItem} data-active={view === "favorites"} onClick={() => setView("favorites")}>
          <span><span style={{ fontSize: 19 }}>♥</span></span>Favorites
        </button>
        <button className={styles.navItem} data-active={view === "profile"} onClick={() => setView("profile")}>
          <span><img className={styles.navImg} src="/icons/profile.png" alt="" /></span>Profile
        </button>
        {/* eslint-enable @next/next/no-img-element */}
      </nav>
    </div>
  );
}