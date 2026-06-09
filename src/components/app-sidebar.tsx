"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { signOut } from "@/app/login/actions";
import { KhonseraBrand } from "./khonsera-brand";
import { ModeSwitchControl } from "./mode-switch-control";
import type { AppMode } from "@/lib/mode";

type NavItem = {
  href: Route;
  label: string;
  icon: keyof typeof Glyphs;
  section: "primary" | "you";
  count?: number;
};

// Desktop mirror of the primary nav (standing brief, Track A): Today · Plan ·
// Tasks · People — mode-aware (Work → Clients). Secondary items live under "You".
// Legacy routes (dashboard/bookings/flights/locations) still exist (parity-before-
// strip) but are no longer surfaced in nav.
function navFor(mode: AppMode): NavItem[] {
  return [
    { href: "/today" as Route, label: "Today", icon: "bolt", section: "primary" },
    { href: "/plan" as Route, label: "Plan", icon: "nav", section: "primary" },
    { href: "/tasks" as Route, label: "Tasks", icon: "case", section: "primary" },
    mode === "work"
      ? { href: "/customers" as Route, label: "Clients", icon: "case", section: "primary" }
      : { href: "/contacts" as Route, label: "People", icon: "case", section: "primary" },
    { href: "/expenses" as Route, label: "Expenses", icon: "receipt", section: "you" },
    ...(mode === "work"
      ? [{ href: "/workspace" as Route, label: "Workspace", icon: "case", section: "you" } as NavItem]
      : []),
    { href: "/settings" as Route, label: "Settings", icon: "settings", section: "you" },
  ];
}

export function AppSidebar({
  email,
  workspaceName,
  mode,
}: {
  email: string;
  workspaceName?: string;
  mode: AppMode;
}) {
  const pathname = usePathname();
  const items = navFor(mode);
  const primary = items.filter((n) => n.section === "primary");
  const you = items.filter((n) => n.section === "you");

  const initial = email[0]?.toUpperCase() ?? "•";

  return (
    <aside className="desk-sidebar">
      <div className="brand">
        <KhonseraBrand size="md" />
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 1.6,
            color: "var(--ink-faint)",
            marginTop: 8,
            textTransform: "uppercase",
          }}
        >
          Workspace · {workspaceName ?? "Personal"}
        </div>
        <div style={{ marginTop: 12 }}>
          <ModeSwitchControl mode={mode} size="md" />
        </div>
      </div>

      {/* Tell Khonsera — an action, not a nav destination. Reachable from every
          page; opens the capture screen. */}
      <Link
        href={"/capture" as Route}
        className="btn btn-gold"
        style={{ margin: "4px 0 12px", justifyContent: "center" }}
      >
        <Glyph name="tell" />
        Tell Khonsera
      </Link>

      <nav className="desk-nav">
        {primary.map((n) => (
          <NavLink key={n.href} item={n} pathname={pathname} />
        ))}

        <div className="desk-nav-section" style={{ marginTop: 12 }}>
          You
        </div>
        {you.map((n) => (
          <NavLink key={n.href} item={n} pathname={pathname} />
        ))}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 8px",
            borderTop: "1px solid var(--rule)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "var(--gold)",
              color: "var(--paper)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--display)",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: "0.04em",
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--sans)",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={email}
            >
              {email.split("@")[0]}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {email}
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title="Sign out"
              className="icon-button"
              style={{ width: 28, height: 28 }}
            >
              <Glyph name="exit" size={14} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
  return (
    <Link
      href={item.href}
      data-active={active}
      className="desk-nav-item"
    >
      <Glyph name={item.icon} size={17} />
      <span>{item.label}</span>
      {item.count != null ? <span className="count">{item.count}</span> : null}
    </Link>
  );
}

const Glyphs = {
  bolt: "M13 2 L4 14 h6 l-1 8 9-12 h-6 z",
  tell: "M4 5 a2 2 0 0 1 2-2 h12 a2 2 0 0 1 2 2 v8 a2 2 0 0 1-2 2 H9 l-5 4 z",
  nav: "M3 11 L21 3 L13 21 L11 13 L3 11 z",
  ticket:
    "M3 9 a2 2 0 0 1 2-2 h14 a2 2 0 0 1 2 2 v2 a2 2 0 0 0 0 2 v2 a2 2 0 0 1-2 2 H5 a2 2 0 0 1-2-2 v-2 a2 2 0 0 0 0-2 z M9 7 v10",
  plane: "M2 14 L22 7 L15 22 L12 15 z",
  case:
    "M3 7 h18 v13 h-18 z M8 7 V5 a2 2 0 0 1 2-2 h4 a2 2 0 0 1 2 2 v2",
  pin: "M12 22 s-7-7.5-7-13 a7 7 0 1 1 14 0 c0 5.5-7 13-7 13 z M12 9 a2 2 0 1 0 0 4 a2 2 0 0 0 0-4",
  receipt: "M6 3 h12 v18 l-3-2 -3 2 -3-2 -3 2 z M9 8 h6 M9 12 h6 M9 16 h4",
  settings:
    "M12 2 v3 M12 19 v3 M5 12 H2 M22 12 h-3 M5.6 5.6 L3.5 3.5 M20.5 20.5 l-2.1-2.1 M18.4 5.6 l2.1-2.1 M5.6 18.4 l-2.1 2.1 M12 8 a4 4 0 1 1 0 8 a4 4 0 0 1 0-8",
  exit: "M9 4 H4 v16 h5 M16 17 l5-5-5-5 M21 12 H9",
} as const;

function Glyph({
  name,
  size = 18,
}: {
  name: keyof typeof Glyphs;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={Glyphs[name]} />
    </svg>
  );
}
