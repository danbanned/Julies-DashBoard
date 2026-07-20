"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushSetup({ className = "" }) {
  const [state, setState] = useState("hidden");

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
    return () => { cancelled = true; };
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

  // hidden or done → render nothing
  if (state === "hidden" || state === "done") return null;

  // denied → render a <div> with the passed className
  if (state === "denied") {
    return (
      <div className={className}>
        Notifications are blocked — allow them in site settings to get event alerts.
      </div>
    );
  }

  // ready / busy / error → render a <button> with the passed className
  return (
    <button className={className} onClick={enable} disabled={state === "busy"}>
      {state === "busy"
        ? "Setting up…"
        : state === "error"
          ? "Couldn't enable — try again"
          : "🔔 Enable notifications"}
    </button>
  );
}