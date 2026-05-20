import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Newsreader({
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
});
const display = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Khonsera — quietly luxe travel planning",
  description:
    "Khonsera plans, confirms and executes your trips. Editorial, warm and quietly intelligent.",
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
      data-palette="dusk"
      className={`${sans.variable} ${mono.variable} ${serif.variable} ${display.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
