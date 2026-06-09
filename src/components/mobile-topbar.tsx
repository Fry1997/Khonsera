import Link from "next/link";
import { KhonseraBrand } from "./khonsera-brand";
import { MobileNav } from "./mobile-nav";
import { DemoModeIndicator } from "./demo-mode-indicator";
import { ModeSwitchControl } from "./mode-switch-control";
import type { AppMode } from "@/lib/mode";
import type { Route } from "next";

// The "more" menu behind the topbar — the 4 primary items live in the bottom
// tab bar; this carries the secondary destinations. (Legacy routes still exist
// per parity-before-strip but are no longer surfaced.)
const NAV = [
  { href: "/today" as Route, label: "Today" },
  { href: "/itineraries" as Route, label: "Plan" },
  { href: "/tasks" as Route, label: "Tasks" },
  { href: "/contacts" as Route, label: "People" },
  { href: "/expenses" as Route, label: "Expenses" },
  { href: "/workspace" as Route, label: "Workspace" },
  { href: "/settings" as Route, label: "Settings" },
] as const;

// Server component — DemoModeIndicator needs server-only cookies(), so
// composing it here is the right place. The MobileNav inside is a client
// component and works fine being nested.
export async function MobileTopbar({
  email,
  isStaff,
  mode,
}: {
  email: string;
  isStaff: boolean;
  mode: AppMode;
}) {
  return (
    <header
      className="lg:hidden"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "12px 16px",
        background: "var(--paper)",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      <KhonseraBrand size="sm" />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ModeSwitchControl mode={mode} size="sm" />
        {isStaff ? <DemoModeIndicator /> : null}
        {/* Tell — an action reachable from every page, not a nav destination. */}
        <Link href={"/capture" as Route} className="btn btn-gold btn-sm" aria-label="Tell Khonsera">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 5 a2 2 0 0 1 2-2 h12 a2 2 0 0 1 2 2 v8 a2 2 0 0 1-2 2 H9 l-5 4 z" />
          </svg>
          Tell
        </Link>
        <MobileNav items={NAV} email={email} />
      </div>
    </header>
  );
}
