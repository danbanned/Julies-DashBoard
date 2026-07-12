import "./globals.css";

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
  themeColor: "#b25e3f",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
