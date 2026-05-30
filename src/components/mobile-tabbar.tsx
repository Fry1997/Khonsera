"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const TABS = [
  { href: "/dashboard" as Route, label: "Plan", icon: "calendar" },
  { href: "/bookings" as Route, label: "Bookings", icon: "ticket" },
  { href: "/itineraries" as Route, label: "Journey", icon: "nav" },
  { href: "/expenses" as Route, label: "Updates", icon: "bell" },
  { href: "/settings" as Route, label: "Profile", icon: "person" },
] as const;

export function MobileTabbar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar lg:hidden" aria-label="Primary">
      {TABS.map((t) => {
        const active =
          pathname === t.href ||
          (t.href !== "/dashboard" && pathname.startsWith(`${t.href}/`));
        return (
          <Link
            key={t.href}
            href={t.href}
            data-active={active}
            className="tabbar-item"
          >
            <span style={{ position: "relative" }}>
              <Glyph name={t.icon} active={active} />
              {active ? <span className="tabbar-bar" /> : null}
            </span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const GLYPHS = {
  calendar:
    "M4 6 a2 2 0 0 1 2-2 h12 a2 2 0 0 1 2 2 v14 a2 2 0 0 1-2 2 H6 a2 2 0 0 1-2-2 z M4 10 h16 M8 2 v4 M16 2 v4",
  ticket:
    "M3 9 a2 2 0 0 1 2-2 h14 a2 2 0 0 1 2 2 v2 a2 2 0 0 0 0 2 v2 a2 2 0 0 1-2 2 H5 a2 2 0 0 1-2-2 v-2 a2 2 0 0 0 0-2 z M9 7 v10",
  nav: "M3 11 L21 3 L13 21 L11 13 L3 11 z",
  bell: "M6 18 a2 2 0 0 0 2 2 h8 a2 2 0 0 0 2-2 M18 18 V11 a6 6 0 0 0-12 0 v7 z M10 2 h4",
  person: "M12 12 a4 4 0 1 0 0-8 a4 4 0 0 0 0 8 z M4 21 c0-4 4-7 8-7 s8 3 8 7",
} as const;

function Glyph({
  name,
  active,
}: {
  name: keyof typeof GLYPHS;
  active: boolean;
}) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={GLYPHS[name]} />
    </svg>
  );
}
