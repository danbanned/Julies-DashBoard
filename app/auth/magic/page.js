"use client";

// Magic-link landing (21a). Reads ?token=, exchanges it for a session via the
// "magic-link" Credentials provider (auth.js), then redirects. A dead/expired
// token just shows a friendly retry prompt — no dead end.
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import styles from "../../Events.module.css";

export default function MagicLinkPage() {
  const [status, setStatus] = useState("verifying"); // verifying | error

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    signIn("magic-link", { token, redirect: false }).then((result) => {
      if (result?.error) {
        setStatus("error");
      } else {
        window.location.href = "/";
      }
    });
  }, []);

  return (
    <div className={styles.authShell}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Julie&apos;s Event</h1>
        {status === "verifying" ? (
          <p className={styles.authSub}>Signing you in…</p>
        ) : (
          <>
            <p className={styles.authSub}>That link is invalid or expired.</p>
            <a className={styles.authSwap} href="/login">← Get a new sign-in link</a>
          </>
        )}
      </div>
    </div>
  );
}
