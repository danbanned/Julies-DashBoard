"use client";

// Phase 23 — public "Work with Julie" page: phone number + a lead-capture
// form that creates a CRM Client (not a newsletter Subscriber). Mirrors
// SubscribePage.js's structure/conventions (manual useState form, no form
// library, useSaveFeedback for the success moment).
import { useState } from "react";
import styles from "../app/Events.module.css";
import { useSaveFeedback } from "./Feedback";

const PHONE_DISPLAY = "(267) 270-2757";
const PHONE_TEL = "tel:2672702757";

const INTENTS = [
  { value: "RENT", label: "Renting" },
  { value: "BUY", label: "Buying" },
  { value: "UNSURE", label: "Not sure yet" },
];

export default function WorkWithJulie() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [intent, setIntent] = useState("RENT");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const fb = useSaveFeedback();

  async function submit() {
    if (!name.trim()) { setNotice("Enter your name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNotice("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, intent, message }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setNotice(d.error || "Something went wrong."); return; }
    fb.fireCelebration("Thanks! Julie will be in touch 🎉");
    setSent(true);
    setName("");
    setEmail("");
    setMessage("");
    setIntent("RENT");
  }

  return (
    <div className={styles.shell}>
      <header className={styles.vHero}>
        <div className={styles.vBrandRow}>
          <a className={styles.vSignIn} href="/">← Events</a>
          <span className={styles.vBrand}>Julie&apos;s Event</span>
          <span />
        </div>
        <h1 className={styles.vHeroTitle}>📞 Work with Julie</h1>
        <p className={styles.vHeroSub}>Looking to rent or buy in Philly? Reach out directly.</p>
      </header>

      <div className={styles.panel}>
        <a className={styles.syncBtn} href={PHONE_TEL}>📞 Call {PHONE_DISPLAY}</a>

        <div className={styles.subForm} style={{ marginTop: 18 }}>
          <p className={styles.subEmailLocked}>Or leave your info and Julie will reach out:</p>

          <input
            className={styles.authInput}
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={styles.authInput}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className={styles.subHoods}>
            {INTENTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={styles.typeChip}
                data-active={intent === opt.value}
                onClick={() => setIntent(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <textarea
            className={styles.authInput}
            placeholder="Anything else Julie should know? (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          {notice && <p className={styles.calNotice}>{notice}</p>}

          <button className={styles.syncBtn} onClick={submit} disabled={busy}>
            {busy ? "Sending…" : "Send"}
          </button>

          {sent && <p className={styles.subPending}>✅ Got it — Julie will be in touch soon.</p>}
        </div>
      </div>

      {fb.node}
    </div>
  );
}
