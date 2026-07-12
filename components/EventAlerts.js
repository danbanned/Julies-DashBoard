"use client";

// Live IN-TAB updates via ntfy.sh SSE — demoted in Phase 11: Web Push + the
// service worker (PushSetup.js / public/sw.js) is now the notification
// delivery path and works with the tab closed. This listener only keeps an
// OPEN dashboard fresh: refreshes the feed, feeds the bell store, and shows
// an in-app toast. It deliberately does NOT fire OS notifications anymore —
// that would double-notify alongside Web Push.
//
// Privacy note: a public ntfy topic is a shared secret — anyone who knows the
// topic name can read/publish. Fine for low-stakes event pings; never send
// anything sensitive over it.
import { useEffect, useRef, useState } from "react";
import styles from "../app/Events.module.css";

const TOPIC = process.env.NEXT_PUBLIC_NTFY_TOPIC || "";

export default function EventAlerts({ onNewEvent, onNotification }) {
  const [toast, setToast] = useState(null);
  const seen = useRef(new Set());
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!TOPIC || typeof window === "undefined" || !("EventSource" in window)) return;

    const es = new EventSource(`https://ntfy.sh/${encodeURIComponent(TOPIC)}/sse`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // ntfy may redeliver after reconnects — dedupe by message id
        if (data.event !== "message" || seen.current.has(data.id)) return;
        seen.current.add(data.id);

        const title = data.title || "New Philly event";
        // hand the message to the persisted bell store (10.1); ntfy `time`
        // is unix seconds
        onNotification?.({
          id: data.id,
          title,
          message: data.message || "",
          time: data.time ? data.time * 1000 : Date.now(),
        });
        // in-app toast only — OS notifications come from Web Push now
        setToast({ title, body: data.message || "" });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 8000);

        onNewEvent?.(); // revalidate the feed so the new events + NEW dots appear
      } catch (err) {
        console.error("ntfy parse error", err);
      }
    };
    es.onerror = (err) => console.warn("ntfy stream error (EventSource will retry)", err);

    return () => {
      es.close();
      clearTimeout(toastTimer.current);
    };
  }, [onNewEvent, onNotification]);

  if (!TOPIC || !toast) return null;
  return (
    <div className={styles.toast} role="status">
      <strong>{toast.title}</strong>
      {toast.body && <span>{toast.body}</span>}
    </div>
  );
}
