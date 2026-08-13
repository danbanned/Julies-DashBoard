import { Playfair_Display, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_OPTIONS, SEASON_OPTIONS } from "../lib/config";
import "./globals.css";

// Phase 20 typography: Playfair Display (headings) + Inter (body/UI), loaded
// as CSS variables so globals.css's --font-display/--font-body pick them up
// everywhere without touching every component.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-playfair",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Julie's Events Dashboard",
  description: "Fairmount & Brewerytown events for Julie Tours Philly",
  // PWA manifest (Phase 11e) — required for install + iOS Web Push
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Julie's Events",
  },
  icons: {
    icon: "/icons/app-192.png",
    apple: "/icons/app-192.png",
  },
};

export const viewport = {
  // Lock every page to a true 1:1 mobile scale so nothing ever opens zoomed in.
  width: "device-width",
  initialScale: 1,
  // Extend the layout into the notch/home-indicator area so the CSS
  // env(safe-area-inset-*) values used by the shell + bottom nav resolve.
  viewportFit: "cover",
  themeColor: "#1A1A1A",
};

// Phase 24 — Theme/Seasonal read from cookies (jw_theme/jw_season), the SSR
// path that also works for anonymous visitors (no session lookup needed).
// data-jw-theme / data-jw-season are set here since this is the one place
// both ViewerApp and the admin surfaces (CrmApp, PlaybookApp, EventsSection)
// share — Layout (data-jw-layout) is different: it's applied per-surface,
// see components/CrmApp.js.
export default async function RootLayout({ children }) {
  const jar = await cookies();
  const themeValues = THEME_OPTIONS.map((o) => o.value);
  const seasonValues = SEASON_OPTIONS.map((o) => o.value);
  const theme = themeValues.includes(jar.get("jw_theme")?.value) ? jar.get("jw_theme").value : "original";
  const season = seasonValues.includes(jar.get("jw_season")?.value) ? jar.get("jw_season").value : "off";

  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable}`}
      data-jw-theme={theme}
      data-jw-season={season}
    >
      <body>{children}</body>
    </html>
  );
}
