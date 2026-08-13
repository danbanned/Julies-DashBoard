"use client";

// Phase 24 — Settings: Account fields + Theme/Layout/Seasonal Aesthetic
// pickers. Structured like components/WorkWithJulie.js / SubscribePage.js —
// manual useState form, styles.typeChip for the picker rows, useSaveFeedback
// for the save confirmation. Theme/Layout/Season are disjoint: each only
// ever touches its own cookie/attribute, never each other's.
import { useState } from "react";
import styles from "../app/Events.module.css";
import { useSaveFeedback } from "./Feedback";
import { THEME_OPTIONS, LAYOUT_OPTIONS, SEASON_OPTIONS } from "../lib/config";

export default function SettingsPage({ account, initialPrefs }) {
  const isSignedIn = Boolean(account);
  const isAdmin = account?.role === "ADMIN";

  const [name, setName] = useState(account?.name || "");
  const [phone, setPhone] = useState(account?.phone || "");
  const [password, setPassword] = useState("");
  const [theme, setTheme] = useState(initialPrefs.themePref);
  const [layout, setLayout] = useState(initialPrefs.layoutPref);
  const [season, setSeason] = useState(initialPrefs.seasonPref);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const fb = useSaveFeedback();

  async function submit() {
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, password, themePref: theme, layoutPref: layout, seasonPref: season }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setNotice(d.error || "Something went wrong."); return; }
    setPassword("");
    fb.fireCelebration("Settings saved!");
    // Cookies just changed server-side — reload so data-jw-theme/layout/season
    // on <html> (set in app/layout.js) reflect the new values immediately.
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.vHero}>
        <div className={styles.vBrandRow}>
          <a className={styles.vSignIn} href="/">← Events</a>
          <span className={styles.vBrand}>Julie&apos;s Event</span>
          <span />
        </div>
        <h1 className={styles.vHeroTitle}>⚙️ Settings</h1>
        <p className={styles.vHeroSub}>Account details, layout, theme, and seasonal look.</p>
      </header>

      <div className={styles.panel}>
        <h3>Account</h3>
        {isSignedIn ? (
          <div className={styles.subForm}>
            <input className={styles.authInput} type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <p className={styles.subEmailLocked}>Email: <strong>{account.email}</strong></p>
            <input className={styles.authInput} type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {isAdmin ? (
              <input className={styles.authInput} type="password" placeholder="New password (leave blank to keep current)" value={password} onChange={(e) => setPassword(e.target.value)} />
            ) : (
              <p className={styles.subPending}>You sign in via emailed link — no password needed.</p>
            )}
          </div>
        ) : (
          <p className={styles.subEmailLocked}>Sign in to edit your account details.</p>
        )}
      </div>

      <div className={styles.panel}>
        <h3>Theme</h3>
        <p className={styles.calBlurb}>Button, card, and input geometry — never colors.</p>
        <div className={styles.subHoods}>
          {THEME_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={styles.typeChip} data-active={theme === opt.value} onClick={() => setTheme(opt.value)} title={opt.blurb}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.panel}>
        <h3>Layout</h3>
        <p className={styles.calBlurb}>Each option applies to the pages it fits — see the hint below each choice.</p>
        <div className={styles.subHoods}>
          {LAYOUT_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={styles.typeChip} data-active={layout === opt.value} onClick={() => setLayout(opt.value)} title={`${opt.blurb} (${opt.scope})`}>
              {opt.label}
              <br />
              <small style={{ opacity: 0.7, fontWeight: 400 }}>{opt.scope}</small>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.panel}>
        <h3>Seasonal Aesthetic</h3>
        <p className={styles.calBlurb}>Changes accent colors everywhere, plus the Home hero photo (Featured Image layout only) — never button/card shape or the dark background.</p>
        <div className={styles.subHoods}>
          {SEASON_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={styles.typeChip} data-active={season === opt.value} onClick={() => setSeason(opt.value)} title={opt.blurb}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {notice && <p className={styles.calNotice}>{notice}</p>}
      <button className={styles.syncBtn} onClick={submit} disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </button>

      {fb.node}
    </div>
  );
}
