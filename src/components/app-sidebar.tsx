"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { PlanCreate } from "@/components/plan/plan-create";
import type { AppMode } from "@/lib/mode";
import { isActiveNav, navFor, navigationGlyphs, type NavigationIcon } from "@/lib/navigation";

// Desktop rail — Design Round 2 (`.cc-rail`): lockup top, nav list, then a foot
// with the create action + profile. Navigation content, labels, glyphs, active
// matching, and mode variants are shared with mobile via `@/lib/navigation`.
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
  const groups = navFor(mode);
  const init = initials ?? email[0]?.toUpperCase() ?? "·";

  return (
    <aside className="cc-rail">
      <Link href="/today" className="cc-lockup" aria-label="Khonsera">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mk-ink.png" alt="" />
        <span className="wm">KHONSERA</span>
      </Link>

      <nav className="cc-rail-nav">
        {groups.map((g) => (
          <div key={g.label} className="cc-rail-group">
            <span className="cc-rail-group-label">{g.label}</span>
            {g.items.map((n) => {
              const active = isActiveNav(pathname, n.href);
              return (
                <Link key={n.href} href={n.href} className="cc-rail-item" data-active={active ? "true" : "false"}>
                  <span className="ic"><Glyph name={n.icon} /></span>
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="cc-rail-foot">
        <PlanCreate label="Plan a day" className="cc-btn cc-btn-gold cc-btn-block" />
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

function Glyph({ name }: { name: NavigationIcon }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={navigationGlyphs[name]} />
    </svg>
  );
}
