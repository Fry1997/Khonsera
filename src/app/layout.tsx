import type { Metadata, Viewport } from "next";
import {
  Inter,
  JetBrains_Mono,
  Lora,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";

// Canonical Khonsera type stack:
//   • Inter           — sans / UI
//   • Lora            — serif body italic
//   • Playfair Display — display italic (wordmark + chapter heads)
//   • JetBrains Mono  — mono numerals + labels
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Lora({
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
});
const display = Playfair_Display({
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Khonsera — quietly luxe travel planning",
  description:
    "Khonsera plans, confirms and executes your trips. The traveller's evening — calm, considered, confident.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f1e6",
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
      className={`${sans.variable} ${mono.variable} ${serif.variable} ${display.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
