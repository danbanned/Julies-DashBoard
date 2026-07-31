"use client";

// Viewer sign-in (21a) — magic link only, no password. Julie's admin login
// is a separate, deliberately-secondary path on this same page (still the
// original password + Credentials("credentials") flow, completely
// unchanged) behind a small toggle so this page stays the single entry point.
import { useState } from "react";
import { signIn } from "next-auth/react";
import styles from "../Events.module.css";

export default function LoginPage() {
  const [mode, setMode] = useState("magic"); // magic | sent | admin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestMagicLink(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Couldn't send that link — try again.");
        setBusy(false);
        return;
      }
      setMode("sent");
    } catch {
      setError("Something went wrong — try again.");
    }
    setBusy(false);
  }

  async function adminSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Wrong email or password.");
        setBusy(false);
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Something went wrong — try again.");
      setBusy(false);
    }
  }

  return (
    <div className={styles.authShell}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Julie&apos;s Event</h1>

        {mode === "sent" ? (
          <>
            <p className={styles.authSub}>📬 Check your inbox</p>
            <p className={styles.authHint}>
              We sent a sign-in link to <strong>{email}</strong>. Tap it to continue — it expires in 15 minutes.
            </p>
            <button className={styles.authSwap} onClick={() => setMode("magic")}>← Use a different email</button>
          </>
        ) : mode === "admin" ? (
          <>
            <p className={styles.authSub}>Julie&apos;s admin sign-in</p>
            <form onSubmit={adminSubmit} className={styles.authForm}>
              <input
                className={styles.authInput}
                type="email"
                placeholder="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className={styles.authInput}
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className={styles.authError}>{error}</p>}
              <button className={styles.authBtn} disabled={busy}>{busy ? "One sec…" : "Sign in"}</button>
            </form>
            <button className={styles.authSwap} onClick={() => { setMode("magic"); setError(""); }}>← Back</button>
          </>
        ) : (
          <>
            <p className={styles.authSub}>Discover. Connect. Experience Philly.</p>
            <form onSubmit={requestMagicLink} className={styles.authForm}>
              <input
                className={styles.authInput}
                type="email"
                placeholder="Your email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className={styles.authHint}>
                We&apos;ll use your email to keep you updated about local events, reminders, and
                exclusive community happenings. No password to remember — we&apos;ll email you a
                link to sign in.
              </p>
              {error && <p className={styles.authError}>{error}</p>}
              <button className={styles.authBtn} disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
            </form>
          </>
        )}

        {mode === "magic" && (
          <>
            <a className={styles.authSwap} href="/">← Keep browsing without an account</a>
            <button className={styles.authSwap} onClick={() => { setMode("admin"); setError(""); }}>Julie? Sign in with password</button>
          </>
        )}
      </div>
    </div>
  );
}
