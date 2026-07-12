"use client";

import { useEffect, useRef, useState } from "react";

// NEXT_PUBLIC_* vars are inlined at build time; empty/missing → no map,
// the parent keeps showing the static bubble panel instead.
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Load the Maps JS API exactly once, shared across renders.
// NOTE: with `loading=async` the API is NOT ready at the script's onload —
// resolving there makes the map silently fail. Google's `callback` param is
// the supported ready signal.
let mapsPromise = null;
function loadMaps() {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.Map) return resolve(window.google);
    const cb = "__julieMapsReady";
    window[cb] = () => resolve(window.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error("maps failed"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export const hasMapsKey = Boolean(KEY);

// Dark style so the map sits naturally inside the navy panel.
const NIGHT_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1b2559" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8f97c9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1437" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#222f66" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1437" }] },
];

export default function EventsMap({ points, className }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!KEY || !ref.current) return;
    let cancelled = false;
    loadMaps()
      .then((google) => {
        if (cancelled || !ref.current) return;
        const map = new google.maps.Map(ref.current, {
          center: { lat: 39.9648, lng: -75.172 }, // Fairmount-ish
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          styles: NIGHT_STYLE,
        });
        const bounds = new google.maps.LatLngBounds();
        points.forEach((p, i) => {
          // Centroid-fallback events share coordinates — spread them in a
          // small deterministic ring so every marker stays visible. Exact
          // venue coordinates are never nudged.
          const angle = (i % 8) * (Math.PI / 4);
          const r = p.exact ? 0 : 0.0018 * (1 + Math.floor(i / 8) * 0.6);
          const pos = {
            lat: p.lat + Math.sin(angle) * r,
            lng: p.lng + Math.cos(angle) * r,
          };
          new google.maps.Marker({ position: pos, map, title: p.title });
          bounds.extend(pos);
        });
        if (points.length > 1) map.fitBounds(bounds, 40);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [points]);

  if (!KEY || failed) return null;
  return <div ref={ref} className={className} />;
}
