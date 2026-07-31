import { Playfair_Display, Inter } from "next/font/google";
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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
