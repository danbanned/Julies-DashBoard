import "./globals.css";

export const metadata = {
  title: "Julie's Events Dashboard",
  description: "Fairmount & Brewerytown events for Julie Tours Philly",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
