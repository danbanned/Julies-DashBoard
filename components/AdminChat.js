"use client";

import { useEffect, useState, useRef } from "react";
import styles from "../app/Events.module.css";
import { useSaveFeedback } from "./Feedback";

// 18d: post types match the filter tab labels. "All Posts" carries no type.
const POST_TYPES = [
  { key: "CONTENT_IDEAS", label: "Content Ideas" },
  { key: "NEIGHBORHOODS", label: "Neighborhoods" },
  { key: "LISTINGS", label: "Listings" },
];
const TYPE_LABEL = { CONTENT_IDEAS: "Content Ideas", NEIGHBORHOODS: "Neighborhoods", LISTINGS: "Listings" };
const FILTER_TABS = [{ key: "all", label: "All Posts" }, ...POST_TYPES];

// Helper for stable visitor ID
function getVisitorId() {
  let id = localStorage.getItem("visitorId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("visitorId", id);
  }
  return id;
}

export default function AdminChat() {
  const [posts, setPosts] = useState(null);
  const [post, setPost] = useState({ title: "", caption: "", coverImageUrl: "", postType: "" });
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState("all"); // 18d: active filter tab
  const [editing, setEditing] = useState(null); // 18a: post being edited (draft object)
  const fileInputRef = useRef(null);
  const fb = useSaveFeedback();

  // Track selected option per post: { [postId]: option }
  const [selected, setSelected] = useState({});
  // Track local stats (to update counts without re‑fetching)
  const [localStats, setLocalStats] = useState({});

  const load = () =>
    fetch("/api/posts")
      .then((r) => r.json())
      .then((d) => {
        setPosts(d.posts || []);
        // Initialize localStats from the pollStats returned
        const stats = {};
        (d.posts || []).forEach((p) => {
          stats[p.id] = p.pollStats || { please_post: 0, not_like: 0, thank_you: 0 };
        });
        setLocalStats(stats);
      })
      .catch(() => setPosts([]));
  useEffect(() => { load(); }, []);

  async function send() {
    if (!post.title.trim() || !post.caption.trim()) {
      setNotice("Post needs a title and a caption.");
      return;
    }
    if (!post.postType) {
      setNotice("Pick a post type first.");
      return;
    }
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    if (res.ok) {
      setNotice("");
      setPost({ title: "", caption: "", coverImageUrl: "", postType: "" });
      await load();
      fb.fireCelebration("Posted to the family! 🎉"); // deliberate "Post" → celebrate
    } else {
      setNotice((await res.json()).error || "Couldn't post.");
    }
  }

  // 18a: edit an existing post (title/caption/cover/type). Silent — no "edited"
  // marker on the card — but the save itself still confirms (18b/18c).
  async function saveEdit() {
    if (!editing) return;
    if (!editing.title.trim() || !editing.caption.trim()) {
      setNotice("Title and caption can't be empty.");
      return;
    }
    const res = await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        title: editing.title,
        caption: editing.caption,
        coverImageUrl: editing.coverImageUrl || null,
        postType: editing.postType,
      }),
    });
    if (res.ok) {
      setEditing(null);
      await load();
      fb.fireCelebration("Post updated!");
    } else {
      setNotice((await res.json()).error || "Couldn't save the edit.");
    }
  }

  async function deletePost(id, title) {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
    // optimistic removal
    setPosts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    const res = await fetch(`/api/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setNotice("🗑 Post deleted.");
    } else {
      setNotice("Couldn't delete the post.");
      load(); // restore on failure
    }
  }

  const openFilePicker = () => fileInputRef.current?.click();
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPost((prev) => ({ ...prev, coverImageUrl: data.url }));
      setNotice("✅ Image uploaded!");
    } catch (err) {
      console.error(err);
      setNotice("❌ Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const handlePollClick = async (postId, option) => {
    const visitorId = getVisitorId();
    try {
      const res = await fetch("/api/posts?action=vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, option, visitorId }),
      });
      if (res.ok) {
        // Update local state: selected option and increment count
        setSelected((prev) => ({ ...prev, [postId]: option }));
        setLocalStats((prev) => ({
          ...prev,
          [postId]: {
            ...prev[postId],
            [option]: (prev[postId]?.[option] || 0) + 1,
            total: (prev[postId]?.total || 0) + 1,
          },
        }));
      } else {
        setNotice("❌ Couldn't record vote.");
      }
    } catch {
      setNotice("❌ Network error.");
    }
  };

  return (
    <div className={styles.chatContainer}>
      {/* ---- Header ---- */}
      <div className={styles.chatHeader}>
        <h1>Julie's CRM</h1>
        <div className={styles.chatSubHeader}>
          <h2>Family Chat</h2>
          <p>Share ideas. Get feedback. Build community.</p>
        </div>
      </div>

      {/* ---- Composer ---- */}
      <div className={styles.chatComposer}>
        <h3>What are you sharing today?</h3>
        <div className={styles.composerInputs}>
          <input
            className={styles.authInput}
            placeholder="Post title *"
            value={post.title}
            onChange={(e) => setPost({ ...post, title: e.target.value })}
          />
          <textarea
            className={styles.authInput}
            rows={2}
            placeholder="Caption *"
            value={post.caption}
            onChange={(e) => setPost({ ...post, caption: e.target.value })}
          />
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              className={styles.authInput}
              style={{ flex: 1 }}
              placeholder="Cover image URL (or click pin to upload)"
              value={post.coverImageUrl}
              onChange={(e) => setPost({ ...post, coverImageUrl: e.target.value })}
            />
            <button
              className={styles.iconBtn}
              onClick={openFilePicker}
              disabled={uploading}
              title="Upload image"
            >
              {uploading ? "⏳" : "📌"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>
          {/* 18d: required post-type picker */}
          <div className={styles.typePicker}>
            <span className={styles.typePickerLabel}>Post type *</span>
            <div className={styles.typePickerBtns}>
              {POST_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={styles.typeChip}
                  data-active={post.postType === t.key}
                  onClick={() => setPost({ ...post, postType: t.key })}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button className={styles.syncBtn} onClick={send} disabled={uploading}>
            Post
          </button>
        </div>
        {notice && <p className={styles.calNotice}>{notice}</p>}
      </div>

      {/* ---- Tabs (18d: wired to postType) ---- */}
      <div className={styles.chatTabs}>
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            className={filter === t.key ? styles.tabActive : styles.tab}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Feed ---- */}
      <div className={styles.chatFeed}>
        {posts === null ? (
          <p className={styles.calBlurb}>Loading…</p>
        ) : posts.length === 0 ? (
          <div className={styles.empty}>
            <h3>No posts yet</h3>
            <p>Write your first update to engage the family!</p>
          </div>
        ) : posts.filter((p) => filter === "all" || p.postType === filter).length === 0 ? (
          <div className={styles.empty}>
            <h3>Nothing under {FILTER_TABS.find((t) => t.key === filter)?.label}</h3>
            <p>No posts match this filter yet.</p>
          </div>
        ) : (
          posts.filter((p) => filter === "all" || p.postType === filter).map((p) => {
            const stats = localStats[p.id] || { please_post: 0, not_like: 0, thank_you: 0 };
            const total = stats.total || stats.please_post + stats.not_like + stats.thank_you;
            return (
              <div key={p.id} className={styles.postCard}>
                {/* Header: avatar, name, badge, time, delete */}
                <div className={styles.postHeader}>
                  <div className={styles.postAvatar}>{p.author?.name?.[0] || "J"}</div>
                  <div className={styles.postAuthor}>
                    <span className={styles.postName}>Julie</span>
                    <span className={styles.postBadge}>ADMIN</span>
                    <span className={styles.postTime}>
                      {new Date(p.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    className={styles.postDelete}
                    title="Edit this post"
                    aria-label="Edit post"
                    onClick={() => setEditing({ id: p.id, title: p.title, caption: p.caption, coverImageUrl: p.coverImageUrl || "", postType: p.postType || "CONTENT_IDEAS" })}
                  >
                    ✎
                  </button>
                  <button
                    className={styles.postDelete}
                    title="Delete this post"
                    aria-label="Delete post"
                    onClick={() => deletePost(p.id, p.title)}
                  >
                    🗑
                  </button>
                </div>

                {/* Content: edit form (18a) OR title + caption */}
                {editing?.id === p.id ? (
                  <div className={styles.postContent}>
                    <div className={styles.composerInputs}>
                      <input
                        className={styles.authInput}
                        placeholder="Post title *"
                        value={editing.title}
                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                      />
                      <textarea
                        className={styles.authInput}
                        rows={3}
                        placeholder="Caption *"
                        value={editing.caption}
                        onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                      />
                      <input
                        className={styles.authInput}
                        placeholder="Cover image URL"
                        value={editing.coverImageUrl}
                        onChange={(e) => setEditing({ ...editing, coverImageUrl: e.target.value })}
                      />
                      <div className={styles.typePicker}>
                        <span className={styles.typePickerLabel}>Post type</span>
                        <div className={styles.typePickerBtns}>
                          {POST_TYPES.map((t) => (
                            <button
                              key={t.key}
                              type="button"
                              className={styles.typeChip}
                              data-active={editing.postType === t.key}
                              onClick={() => setEditing({ ...editing, postType: t.key })}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className={styles.syncBtn} onClick={saveEdit}>Save</button>
                        <button className={styles.pbTinyBtn} onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className={styles.postContent}>
                  <span className={styles.postTypeBadge} data-type={p.postType}>{TYPE_LABEL[p.postType] || "Content Ideas"}</span>
                  <h4>{p.title}</h4>
                  <p>{p.caption}</p>
                  {p.coverImageUrl && (
                    <div className={styles.postImage}>
                      <img src={p.coverImageUrl} alt="Cover" />
                    </div>
                  )}
                  {/* Example tags – you can generate from title/caption */}
                  <div className={styles.postTags}>
                    {["COFFEE", "GOOD DAYS", "START WITH COFFEE"].map((tag) => (
                      <span key={tag} className={styles.tag}>#{tag}</span>
                    ))}
                  </div>
                </div>
                )}

                {/* Stats: responses, likes, saves */}
                <div className={styles.postStats}>
                  <span>🔥 {stats.please_post}</span>
                  <span>💬 {total}</span>
                  <span>🔖 {stats.thank_you}</span>
                </div>

                {/* Poll / feedback area — icons from public/Familychatattr */}
                <div className={styles.postFeedback}>
                  <div className={styles.feedbackTitle}>
                    <span>How do you feel about this?</span>
                    <a
                      className={styles.feedbackInfo}
                      href="https://www.flaticon.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Thumb icons by rukanicon, Magnific & Md Tanvirul Haque — Flaticon"
                    >
                      ⓘ
                    </a>
                  </div>
                  <div className={styles.feedbackButtons}>
                    {[
                      { key: "please_post", label: "Please post about this!", icon: "/Familychatattr/thumbsup.svg" },
                      { key: "not_like", label: "I don't really like it as much", icon: "/Familychatattr/thumbsinbetween.svg" },
                      { key: "thank_you", label: "Thank you!", icon: "/Familychatattr/thumbsDown.svg" },
                    ].map(({ key, label, icon }) => {
                      const isSelected = selected[p.id] === key;
                      const count = stats[key] || 0;
                      return (
                        <button
                          key={key}
                          className={styles.feedBtn}
                          data-key={key}
                          data-selected={isSelected}
                          onClick={() => handlePollClick(p.id, key)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className={styles.feedIcon} src={icon} alt="" />
                          <span className={styles.feedLabel}>{label}</span>
                          {count > 0 && <span className={styles.pollCount}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {stats.thank_you > 0 && (
                    <div className={styles.feedbackStats}>
                      <span>🔖 Saved by {stats.thank_you} {stats.thank_you === 1 ? "person" : "people"}</span>
                    </div>
                  )}
                </div>

                {/* Admin note – only visible to Julie */}
                <div className={styles.adminNote}>
                  <span>🔒 Admin Note (Only you can see this)</span>
                  <p>Great idea! Fairmount loves local recs. Plan to post this next week.</p>
                  <div className={styles.adminNoteActions}>
                    <button className={styles.remindBtn}>Remind me</button>
                    <span>May 25, 2025</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {fb.node}
    </div>
  );
}