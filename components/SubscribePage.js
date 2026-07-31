"use client";

// The perks/subscribe page itself (Phase 19b). Client component so it can
// read the verify/unsubscribe query-param banners and handle the form.
import { useEffect, useMemo, useState } from "react";
import styles from "../app/Events.module.css";
import { useSaveFeedback } from "./Feedback";
import { NEIGHBORHOOD_OPTIONS } from "../lib/subscribe";

// 21b: the membership pitch, per Julie's incentive list. Not every perk is
// fully wired yet (e.g. "exclusive events" is just a flag on events for now,
// see EventMeta.subscriberExclusive) — the copy can lead, the mechanism
// catches up.
const PERKS = [
  { icon: "📬", text: "Weekly event emails for your neighborhood — no digging through group chats." },
  { icon: "🌟", text: "Exclusive and early-access events before they're public." },
  { icon: "⏰", text: "Reminders so you never miss something you cared about." },
  { icon: "🗓️", text: "Early access to next month's calendar." },
  { icon: "📍", text: "Local recommendations from someone who actually lives here." },
  { icon: "🎉", text: "Holiday and seasonal events as they come up." },
  { icon: "🚫", text: "No spam, no selling your info, one click to unsubscribe any time." },
];

function readQueryBanner() {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  if (p.get("verify") === "ok") return { tone: "good", text: "✅ Email confirmed — you're all set to receive weekly event emails." };
  if (p.get("verify") === "invalid") return { tone: "bad", text: "That confirmation link isn't valid — try subscribing again." };
  if (p.get("unsub") === "ok") return { tone: "good", text: "You've been unsubscribed from weekly event emails." };
  if (p.get("unsub") === "invalid") return { tone: "bad", text: "That unsubscribe link isn't valid." };
  return null;
}

export default function SubscribePage({ viewerEmail, initialSubscriber }) {
  const isLoggedIn = Boolean(viewerEmail);
  const [email, setEmail] = useState("");
  const [neighborhoods, setNeighborhoods] = useState(initialSubscriber?.neighborhoods || []);
  const [notice, setNotice] = useState("");
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);
  const fb = useSaveFeedback();

  useEffect(() => setBanner(readQueryBanner()), []);

  const allSelected = useMemo(
    () => NEIGHBORHOOD_OPTIONS.every((h) => neighborhoods.includes(h)),
    [neighborhoods]
  );

  function toggleHood(h) {
    setNeighborhoods((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  }
  function toggleAll() {
    setNeighborhoods(allSelected ? [] : [...NEIGHBORHOOD_OPTIONS]);
  }

  async function submit() {
    if (!neighborhoods.length) { setNotice("Pick at least one neighborhood."); return; }
    if (!isLoggedIn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNotice("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, neighborhoods }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setNotice(d.error || "Something went wrong."); return; }

    if (isLoggedIn) {
      fb.fireToast("Preferences saved");
    } else if (d.verifyEmailSent) {
      fb.fireCelebration("Check your inbox to confirm! 📬");
    } else {
      fb.fireCelebration("You're subscribed! 🎉");
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.vHero}>
        <div className={styles.vBrandRow}>
          <a className={styles.vSignIn} href="/">← Events</a>
          <span className={styles.vBrand}>Julie&apos;s Event</span>
          <span />
        </div>
        <h1 className={styles.vHeroTitle}>📬 Weekly Neighborhood Events</h1>
        <p className={styles.vHeroSub}>
          {isLoggedIn ? "Update which neighborhoods you want to hear about." : "Unlock weekly event emails for your neighborhood."}
        </p>
      </header>

      {banner && <p className={styles.calNotice} data-tone={banner.tone}>{banner.text}</p>}

      <div className={styles.panel}>
        {!isLoggedIn && (
          <ul className={styles.subPerks}>
            {PERKS.map((p) => (
              <li key={p.text}><span className={styles.subPerkIcon}>{p.icon}</span>{p.text}</li>
            ))}
          </ul>
        )}

        <div className={styles.subForm}>
          {isLoggedIn ? (
            <p className={styles.subEmailLocked}>Sending to <strong>{viewerEmail}</strong></p>
          ) : (
            <input
              className={styles.authInput}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}

          <div className={styles.subHoods}>
            <button type="button" className={styles.typeChip} data-active={allSelected} onClick={toggleAll}>
              All neighborhoods
            </button>
            {NEIGHBORHOOD_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                className={styles.typeChip}
                data-active={neighborhoods.includes(h)}
                onClick={() => toggleHood(h)}
              >
                {h}
              </button>
            ))}
          </div>

          {notice && <p className={styles.calNotice}>{notice}</p>}

          <button className={styles.syncBtn} onClick={submit} disabled={busy}>
            {busy ? "Saving…" : isLoggedIn ? "Save preferences" : "Subscribe"}
          </button>

          {initialSubscriber && !initialSubscriber.emailVerified && (
            <p className={styles.subPending}>⏳ Check your inbox — your email isn't confirmed yet.</p>
          )}
        </div>
      </div>

      {fb.node}
    </div>
  );
}
