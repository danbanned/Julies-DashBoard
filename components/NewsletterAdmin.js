"use client";

// Admin view of the Phase 19 newsletter (replaces the old Family Chat post
// composer — the public page it fed is now the subscribe pitch, so a post
// feed here would have no audience). Lightweight stats only, per 19d — this
// is deliberately NOT a CRM-style management page.
import { useEffect, useState } from "react";
import styles from "../app/Events.module.css";
import { NEIGHBORHOOD_OPTIONS } from "../lib/subscribe";

export default function NewsletterAdmin() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch("/api/admin/subscribers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.total !== undefined && setStats(d))
      .catch(() => {});
  }, []);

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <h1>Julie&apos;s CRM</h1>
        <div className={styles.chatSubHeader}>
          <h2>📬 Newsletter</h2>
          <p>Weekly neighborhood event emails — subscriber overview.</p>
        </div>
      </div>

      {stats === null ? (
        <p className={styles.calBlurb}>Loading…</p>
      ) : (
        <>
          <div className={styles.panel}>
            <div className={styles.panelHead}><h2>Subscribers</h2></div>
            <div className={styles.detailGrid}>
              <div className={styles.detailGroup}>
                <span className={styles.detailLabel}>Total</span>
                <span className={styles.detailValue}>{stats.total}</span>
              </div>
              <div className={styles.detailGroup}>
                <span className={styles.detailLabel}>Verified</span>
                <span className={styles.detailValue}>{stats.verified}</span>
              </div>
              <div className={styles.detailGroup}>
                <span className={styles.detailLabel}>Pending verification</span>
                <span className={styles.detailValue}>{stats.pending}</span>
              </div>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}><h2>By neighborhood</h2></div>
            <div className={styles.detailGrid}>
              {NEIGHBORHOOD_OPTIONS.map((h) => (
                <div key={h} className={styles.detailGroup}>
                  <span className={styles.detailLabel}>{h}</span>
                  <span className={styles.detailValue}>{stats.byNeighborhood[h] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <p className={styles.calBlurb}>
            Weekly digest emails send automatically every Monday to verified, subscribed neighborhoods —{" "}
            <a className={styles.gcalLink} href="/chat" target="_blank" rel="noopener noreferrer">view the subscribe page ↗</a>
          </p>
        </>
      )}
    </div>
  );
}
