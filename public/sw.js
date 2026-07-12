/* Julie's Dashboard service worker (Phase 11).
   Lives in public/ so it's served from the site root (/sw.js) with root
   scope. Receives Web Push messages and shows notifications even when no
   dashboard tab is open — that's the whole point. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Julie's Dashboard";
  const options = {
    body: data.body || "New events are on your dashboard.",
    icon: data.icon || "/icons/home.png",
    badge: "/icons/bell.png",
    tag: data.tag || "julie-events", // collapse repeats into one notification
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  // Focus an existing dashboard tab if one is open, otherwise open one.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if (new URL(tab.url).origin === self.location.origin && "focus" in tab) {
          tab.navigate(url);
          return tab.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
