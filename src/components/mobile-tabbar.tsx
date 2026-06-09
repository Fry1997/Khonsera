"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { AppMode } from "@/lib/mode";

// Primary nav — the tight, mobile-first bottom bar (standing brief, Track A):
// Today · Plan · Tasks · People. Mode is a TOGGLE (in the topbar), not a tab; in
// Work mode the People slot becomes Clients (same position, mode-aware target).
// Compare / Workspace / Welcome are deliberately NOT nav items.
type Tab = { href: Route; label: string; icon: keyof typeof GLYPHS };

function tabs(mode: AppMode): Tab[] {
  return [
    { href: "/today" as Route, label: "Today", icon: "today" },
    { href: "/plan" as Route, label: "Plan", icon: "plan" },
    { href: "/tasks" as Route, label: "Tasks", icon: "tasks" },
    mode === "work"
      ? { href: "/customers" as Route, label: "Clients", icon: "clients" }
      : { href: "/contacts" as Route, label: "People", icon: "people" },
  ];
}

export function MobileTabbar({ mode }: { mode: AppMode }) {
  const pathname = usePathname();
  return (
    <nav className="tabbar lg:hidden" aria-label="Primary">
      {tabs(mode).map((t) => {
        const active =
          pathname === t.href || pathname.startsWith(`${t.href}/`);
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
  today: "M12 21 a9 9 0 1 0 0-18 a9 9 0 0 0 0 18 z M12 8 v4 l3 2",
  plan: "M4 6 a2 2 0 0 1 2-2 h12 a2 2 0 0 1 2 2 v14 a2 2 0 0 1-2 2 H6 a2 2 0 0 1-2-2 z M4 10 h16 M8 2 v4 M16 2 v4",
  tasks: "M9 11 l2.5 2.5 L17 8 M5 5 h14 a1 1 0 0 1 1 1 v12 a1 1 0 0 1-1 1 H5 a1 1 0 0 1-1-1 V6 a1 1 0 0 1 1-1 z",
  people: "M12 12 a4 4 0 1 0 0-8 a4 4 0 0 0 0 8 z M4 21 c0-4 4-7 8-7 s8 3 8 7",
  clients:
    "M4 8 h16 v11 a1 1 0 0 1-1 1 H5 a1 1 0 0 1-1-1 z M9 8 V6 a2 2 0 0 1 2-2 h2 a2 2 0 0 1 2 2 v2",
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
