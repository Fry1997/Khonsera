import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Canonical Khonsera type stack, per the Visual Identity brand book
// (Edition I · MMXXVI):
//
//   • Satoshi         — display + wordmark + headlines. Loaded from
//                       Fontshare via a <link>; not on Google Fonts.
//   • Inter           — body, UI, captions, standfirst
//   • JetBrains Mono  — codes, times, eyebrows
//   • Cormorant Garamond — editorial serif italic (decorative use only)
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500", "600"],
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
      </head>
      <body>{children}</body>
    </html>
  );
}
