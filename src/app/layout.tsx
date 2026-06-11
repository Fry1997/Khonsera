import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Spectral } from "next/font/google";
import "./globals.css";
import "./khonsera-edition-ii.css"; // ← Edition II brand update (must load AFTER globals.css)
import "./khonsera-edition-ii-screens.css"; // Round 1 screen components (.cc-*) — additive, after the brand layer
import "./khonsera-edition-ii-shell.css"; // Round 2 shell + landing + auth + secondary (.cc-*)
import "./khonsera-edition-ii-landing.css"; // Round 3 landing/waitlist elevation
import "./khonsera-edition-ii-landing-shot.css"; // Round 3 in-context app shot (Code-productionised)
import "./khonsera-edition-ii-documents.css"; // Round 5 booked-document family elevation
import "./khonsera-edition-ii-wallet.css"; // Round 5b first-class Wallet + docked-pass — LAST
import { PwaRegister } from "@/components/pwa-register";

// Canonical Khonsera type stack, per the Visual Identity brand book
// (Edition II · MMXXVI) — SANS-LED:
//
//   • Satoshi         — wordmark, display, headlines, UI *and* body.
//                       Loaded from Fontshare via the <link> below.
//   • JetBrains Mono  — codes, times, eyebrows (the travel-document signature)
//   • Spectral        — rare editorial italic accent only (replaces Cormorant)
//
// Inter is retired: Satoshi now carries body too. The --font-sans variable is
// left bound to Satoshi via khonsera-edition-ii.css, so --sans resolves to
// Satoshi even where globals.css references var(--font-sans).
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Spectral({
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Khonsera — travel days, considered.",
  description:
    "A quiet concierge for the slow blue hour. Plan the in-between hours of your travel — the train that might not be running, the taxi at dusk, the careful arithmetic of getting there.",
  manifest: "/manifest.webmanifest",
  applicationName: "Khonsera",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Khonsera" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f1e8", // Edition II screen paper
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${mono.variable} ${serif.variable}`}
    >
      <head>
        {/* Satoshi — the brand face, carrying wordmark, headlines, UI and
            body in Edition II. Self-served via Fontshare. */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900,300i,400i,500i,700i,900i&display=swap"
        />
        {/* No-FOUC theme init — applies the persisted palette before paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('khonsera:theme');if(t==='sahara'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
