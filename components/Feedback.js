"use client";

// Phase 18b/18c — shared save-feedback primitives used across every admin
// surface so "did my save happen?" is never ambiguous again.
//
//   const fb = useSaveFeedback();
//   ...on an explicit Done/Save button:  fb.fireCelebration("Client saved!")
//   ...on a small inline save (add tag): fb.fireToast("Tag added")
//   render {fb.node} once near the component root.
//
// Rule of thumb (from the handoff): confetti + checkmark is reserved for the
// deliberate "I'm done with this" moment; small inline commits get a quiet
// toast only. Never fire either on micro-toggles, filter chips, or autosaves.
import { useCallback, useRef, useState } from "react";
import styles from "../app/Events.module.css";

const CONFETTI_COLORS = ["#b25e3f", "#7d8a5c", "#c08a3e", "#b4543e", "#5f7470", "#e8c98f"];

export function useSaveFeedback() {
  const [celebrate, setCelebrate] = useState(null); // message | null
  const [toast, setToast] = useState(null); // message | null
  const [tick, setTick] = useState(0); // restarts confetti animation each fire
  const celebrateTimer = useRef(null);
  const toastTimer = useRef(null);

  const fireCelebration = useCallback((message = "Saved!") => {
    setCelebrate(message);
    setTick((t) => t + 1);
    clearTimeout(celebrateTimer.current);
    celebrateTimer.current = setTimeout(() => setCelebrate(null), 2000);
  }, []);

  const fireToast = useCallback((message = "Saved") => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const node = (
    <>
      {celebrate && <SaveCelebration key={tick} message={celebrate} />}
      {toast && <SaveToast message={toast} />}
    </>
  );

  return { fireCelebration, fireToast, node, celebrate, toast };
}

function SaveCelebration({ message }) {
  const pieces = Array.from({ length: 44 }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.25;
    const dur = 1.1 + Math.random() * 1.0;
    const drift = (Math.random() * 2 - 1) * 60;
    const size = 6 + Math.random() * 8;
    return (
      <span
        key={i}
        className={styles.confettiPiece}
        style={{
          left: `${left}%`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          width: `${size}px`,
          height: `${size * 0.62}px`,
          "--drift": `${drift}px`,
          animationDelay: `${delay}s`,
          animationDuration: `${dur}s`,
        }}
      />
    );
  });
  return (
    <div className={styles.celebrate} role="status" aria-live="polite">
      <div className={styles.celebrateConfetti} aria-hidden="true">{pieces}</div>
      <div className={styles.celebrateCard}>
        <div className={styles.celebrateCheck} aria-hidden="true">
          <svg viewBox="0 0 52 52">
            <circle className={styles.celebrateCheckCircle} cx="26" cy="26" r="24" fill="none" />
            <path className={styles.celebrateCheckMark} fill="none" d="M14 27 l8 8 l16 -18" />
          </svg>
        </div>
        <div className={styles.celebrateMsg}>{message}</div>
      </div>
    </div>
  );
}

function SaveToast({ message }) {
  return (
    <div className={styles.saveToast} role="status" aria-live="polite">
      <span className={styles.saveToastCheck}>✓</span>
      <span>{message}</span>
    </div>
  );
}
