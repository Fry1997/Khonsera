import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./khonsera-edition-ii.css"; // ← Edition II brand update (must load AFTER globals.css)
import "./khonsera-edition-ii-screens.css"; // Round 1 screen components (.cc-*) — additive, after the brand layer
import "./khonsera-edition-ii-shell.css"; // Round 2 shell + landing + auth + secondary (.cc-*)
import "./khonsera-edition-ii-landing.css"; // Round 3 landing/waitlist elevation
import "./khonsera-edition-ii-landing-shot.css"; // Round 3 in-context app shot (Code-productionised)
import "./khonsera-edition-ii-documents.css"; // Round 5 booked-document family elevation
import "./khonsera-edition-ii-wallet.css"; // Round 5b first-class Wallet + docked-pass
import "./khonsera-edition-iii.css"; // Edition III build-programme skin (P0–P6)
import "./khonsera-edition-iii-live.css"; // Edition III live spine + disruption (P8–P10)
import "./khonsera-edition-iii-care.css"; // Edition III deviation & care (P11–P13)
import "./khonsera-edition-iii-connections.css"; // Edition III connections/booking (P14)
import "./khonsera-edition-iii-sharing.css"; // Edition III sharing/comms/safety (P18)
import "./khonsera-edition-iii-round13.css"; // Edition III Round 13 coherence + features skin
import "./khonsera-edition-iii-nav.css"; // Edition III N1 — premium guidance surface (.cc-nav*) — LAST
import "./khonsera-instrument.css"; // Instrument Edition v8 — reviewed production direction, final authority
import "./khonsera-today-direction.css"; // Jul 2026 app direction — unified shell + route-first Today surface
import "./khonsera-screen-one.css"; // Jul 2026 Screen One — approved compact orange Today direction
import "./khonsera-mobile-today-reference.css"; // Aug 2026 — approved mobile visual reference, final Today authority
import { PwaRegister } from "@/components/pwa-register";

// Canonical Instrument Edition type stack:
//
//   • Satoshi         — wordmark, display, headlines, UI and body.
//   • JetBrains Mono  — codes, times, eyebrows (the travel-document signature)
//
// The editorial serif and pictorial mark are retired. Emphasis comes from
// weight, tracking, and the mono transit layer.
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Khonsera — travel days that run on time.",
  description:
    "The operational layer for travel days: commitments, live timing, protected buffers, fallbacks, and next-best actions in one accountable plan.",
  manifest: "/manifest.webmanifest",
  applicationName: "Khonsera",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Khonsera",
  },
  other: {
    // Android/Chrome PWA standalone hint (the apple-* meta above covers iOS).
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover lets the app paint into the notch/home-indicator area so
  // env(safe-area-inset-*) becomes non-zero — the appbar/tabbar then inset
  // themselves to clear the status bar + home-indicator (see the shell layout).
  viewportFit: "cover",
  themeColor: "#f7f7f4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" className={mono.variable}>
      <head>
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