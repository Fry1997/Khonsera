"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { signOut } from "@/app/login/actions";
import { ModeSwitchControl } from "./mode-switch-control";
import type { AppMode } from "@/lib/mode";

// Desktop rail — Design Round 2 (`.cc-rail`): lockup top, nav list, then a foot
// with the mode toggle + Tell + profile. The content column stays centred
// (`.cc-shell-col`). Today · Plan · Tasks · People→Clients (Work).
type NavItem = { href: Route; label: string; icon: keyof typeof Glyphs };

function navFor(mode: AppMode): NavItem[] {
  return [
    { href: "/today" as Route, label: "Today", icon: "today" },
    { href: "/plan" as Route, label: "Plan", icon: "plan" },
    { href: "/tasks" as Route, label: "Tasks", icon: "tasks" },
    mode === "work"
      ? { href: "/customers" as Route, label: "Clients", icon: "clients" }
      : { href: "/contacts" as Route, label: "People", icon: "people" },
    { href: "/expenses" as Route, label: "Expenses", icon: "receipt" },
    ...(mode === "work" ? [{ href: "/workspace" as Route, label: "Workspace", icon: "clients" } as NavItem] : []),
    { href: "/settings" as Route, label: "Settings", icon: "settings" },
  ];
}

export function AppSidebar({
  email,
  firstName,
  initials,
  mode,
}: {
  email: string;
  firstName?: string;
  initials?: string;
  workspaceName?: string;
  mode: AppMode;
}) {
  const pathname = usePathname();
  const items = navFor(mode);
  const init = initials ?? email[0]?.toUpperCase() ?? "·";

  return (
    <aside className="cc-rail">
      <Link href={"/today" as Route} className="cc-lockup" aria-label="Khonsera">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mk-ink.png" alt="" />
        <span className="wm">KHONSERA</span>
      </Link>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((n) => {
          const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
          return (
            <Link key={n.href} href={n.href} className="cc-rail-item" data-active={active ? "true" : "false"}>
              <span className="ic"><Glyph name={n.icon} /></span>
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="cc-rail-foot">
        <ModeSwitchControl mode={mode} size="md" />
        <Link href={"/capture" as Route} className="cc-btn cc-btn-gold cc-btn-block">
          Tell Khonsera
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8, borderTop: "1px solid var(--rule)" }}>
          <span className="cc-overflow-avatar" style={{ width: 32, height: 32 }}>{init}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName ?? email.split("@")[0]}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
          </div>
          <form action={signOut}>
            <button type="submit" className="cc-iconbtn" data-variant="ghost" title="Sign out" style={{ width: 32, height: 32 }}>
              <Glyph name="exit" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

const Glyphs = {
  today: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 8v4l3 2",
  plan: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 10h16M8 2v4M16 2v4",
  tasks: "M9 11l2.5 2.5L17 8 M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  people: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 4-7 8-7s8 3 8 7",
  clients: "M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6M9 12h6M9 16h4",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M4 12h2M18 12h2M12 4v2M12 18v2M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18",
  exit: "M9 4H4v16h5 M16 17l5-5-5-5 M21 12H9",
} as const;

function Glyph({ name }: { name: keyof typeof Glyphs }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={Glyphs[name]} />
    </svg>
  );
}
