import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Newsreader({
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Journies",
  description: "Plan, confirm and execute on-site business visits.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${serif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
