"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppMode } from "@/lib/mode";
import {
  isActiveNav,
  navigationGlyphs,
  primaryNavigation,
  type NavigationIcon,
} from "@/lib/navigation";

// Primary nav — Design's bottom bar (`.cc-tabbar` / `.cc-tab`). Today, Plan,
// Tasks, Wallet, and Navigate stay one tap away so the day's ticket and next-leg
// tools are surfaced when Today has booked travel.
export function MobileTabbar({ mode }: { mode: AppMode }) {
  const pathname = usePathname();
  return (
    <nav className="cc-tabbar" aria-label="Primary">
      {primaryNavigation(mode).map((t) => {
        const active = isActiveNav(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            data-active={active ? "true" : "false"}
            className="cc-tab"
          >
            <span className="cc-tab-ico" aria-hidden>
              <Glyph name={t.icon} />
            </span>
            <span className="cc-tab-label">{t.label}</span>
            <span className="cc-tab-dot" />
          </Link>
        );
      })}
    </nav>
  );
}

function Glyph({ name }: { name: NavigationIcon }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={navigationGlyphs[name]} />
    </svg>
  );
}
