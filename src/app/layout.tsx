import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Spectral } from "next/font/google";
import "./globals.css";

// Canonical Khonsera type stack — Edition II (sans-led, per the brand book):
//
//   • Satoshi         — wordmark + headlines + UI + body. Loaded from
//                       Fontshare via a <link>; not on Google Fonts.
//   • JetBrains Mono  — codes, times, eyebrows
//   • Spectral        — rare editorial serif italic accent (Cormorant retired)
//   • Inter           — retained only as a graceful --font-sans fallback
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Spectral({
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Khonsera — travel days, considered.",
  description:
    "A quiet concierge for the slow blue hour. Plan the in-between hours of your travel — the train that might not be running, the taxi at dusk, the careful arithmetic of getting there.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#efe6d0",
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
      className={`${sans.variable} ${mono.variable} ${serif.variable}`}
    >
      <head>
        {/* Satoshi — display face per the brand book. Self-served via
            Fontshare; Satoshi is not on Google Fonts. */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900,300i,400i,500i,700i,900i&display=swap"
        />
        {/* No-FOUC theme init — applies the persisted palette (dusk /
            sahara / midnight) before first paint. Settings → Palette
            sets the key. Currently only staff can change it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('khonsera:theme');if(t==='sahara'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
