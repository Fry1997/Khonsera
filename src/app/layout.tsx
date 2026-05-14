import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
