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
import "./khonsera-edition-iii-nav.css"; // Edition III N1 — premium guidance surface (.cc-nav*)
import "./khonsera-instrument.css"; // Instrument Edition v8 compatibility and component coverage
import "./khonsera-today-direction.css"; // Legacy route composition; visual rules migrate into the shared system
import "./khonsera-screen-one.css"; // Legacy Today composition; no longer the final visual authority
import "./khonsera-system.css"; // Pass 1 — app-wide tokens, shell, hierarchy and controls
import "./khonsera-components.css"; // Pass 2 — shared navigation, itinerary, transport, document and sheet components
import "./khonsera-primary-flows.css"; // Pass 3 — Today and Plan as one planning-to-operation product flow
import "./khonsera-secondary-surfaces.css"; // Pass 4 — Plan index, Wallet and supporting list surfaces
import "./khonsera-demo.css"; // Staff demo boundary — shared components, isolated scenario data
import "./khonsera-layout.css"; // Pass 5 — spacing, alignment and placement across every app route
import "./khonsera-today-polish.css"; // Focused QA — Today cards, controls and itinerary hierarchy
import "./khonsera-today-feedback.css"; // Detailed review — spine icons, hub dwell, transfers and badge spacing
import { PwaRegister } from "@/components/pwa-register";

// Canonical type stack:
//
//   • Satoshi         — wordmark, display, headlines, UI and body.
//   • JetBrains Mono  — codes, times, eyebrows and technical travel labels.
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
  viewportFit: "cover",
  themeColor: "#f5f1e9",
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
