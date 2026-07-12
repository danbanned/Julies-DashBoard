"use client";

// Web Push setup (Phase 11): registers the service worker on mount and shows
// an "Enable notifications" button until this browser has a stored push
// subscription. This replaces the old EventSource-based OS notifications —
// push works with the tab closed.
import { useEffect, useState } from "react";
import styles from "../app/Events.module.css";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// PushManager.subscribe wants the VAPID key as a Uint8Array.
function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushSetup() {
  const [state, setState] = useState("hidden"); // hidden | ready | busy | done | denied | error

  useEffect(() => {
    if (
      !VAPID_PUBLIC_KEY ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (existing) setState("done");
        else if (Notification.permission === "denied") setState("denied");
        else setState("ready");
      } catch (e) {
        console.warn("service worker registration failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "ready");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState(res.ok ? "done" : "error");
    } catch (e) {
      console.warn("push subscribe failed", e);
      setState("error");
    }
  }

  if (state === "hidden" || state === "done") return null;
  if (state === "denied") {
    return (
      <p className={styles.pushNote}>
        Notifications are blocked in this browser — allow them in site settings to get event alerts.
      </p>
    );
  }
  return (
    <button className={styles.alertsBtn} onClick={enable} disabled={state === "busy"}>
      {state === "busy"
        ? "Setting up…"
        : state === "error"
          ? "Couldn't enable — try again"
          : "🔔 Enable notifications"}
    </button>
  );
}
