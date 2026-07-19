"use client";

// Login + viewer sign-up (12a). Credentials only — no SMTP/OAuth needed.
// Admins land on /admin, viewers on /.
import { useState } from "react";
import { signIn } from "next-auth/react";
import styles from "../Events.module.css";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        if (!res.ok) {
          setError((await res.json()).error || "sign-up failed");
          setBusy(false);
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Wrong email or password.");
        setBusy(false);
        return;
      }
      const me = await fetch("/api/me").then((r) => r.json());
      window.location.href = me.user?.role === "ADMIN" ? "/admin" : "/";
    } catch {
      setError("Something went wrong — try again.");
      setBusy(false);
    }
  }

  return (
    <div className={styles.authShell}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Julie&apos;s Event</h1>
        <p className={styles.authSub}>Discover. Connect. Experience Philly.</p>

        <form onSubmit={submit} className={styles.authForm}>
          {mode === "signup" && (
            <input
              className={styles.authInput}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
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
            placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
            required
            minLength={mode === "signup" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className={styles.authError}>{error}</p>}
          <button className={styles.authBtn} disabled={busy}>
            {busy ? "One sec…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          className={styles.authSwap}
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "New here? Create a free account" : "Have an account? Sign in"}
        </button>
        <a className={styles.authSwap} href="/">
          ← Keep browsing without an account
        </a>
      </div>
    </div>
  );
}
