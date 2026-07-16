"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { PlanCreate } from "@/components/plan/plan-create";
import type { AppMode } from "@/lib/mode";
import { mobileOverflowNavigation, navigationGlyphs, type NavigationIcon } from "@/lib/navigation";

// Mobile app shell header — Design Round 2 (`.cc-appbar`). The fix for the live
// pile-up: emblem-only lockup left (no wordmark → no "KHONSER" clip), exactly two
// quiet icon actions right (Tell + overflow). The mode toggle + secondary
// destinations live in the overflow sheet, so nothing crowds the logo.

function Ico({ name }: { name: NavigationIcon }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={navigationGlyphs[name]} />
    </svg>
  );
}

export function MobileAppbar({
  email,
  firstName,
  initials,
  isStaff,
  mode,
}: {
  email: string;
  firstName: string;
  initials: string;
  isStaff: boolean;
  mode: AppMode;
}) {
  const [open, setOpen] = useState(false);
  const overflowGroups = mobileOverflowNavigation(mode);
  return (
    <>
      <header className="cc-appbar lg:hidden" data-scrolled="false">
        <div className="cc-appbar-left">
          <Link href="/today" className="cc-lockup" data-compact="true" aria-label="Khonsera">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mk-ink.png" alt="" />
            <span className="wm">Khonsera</span>
          </Link>
        </div>
        <div className="cc-appbar-right">
          <PlanCreate className="cc-iconbtn" title="Plan a day">
            <span style={{ width: 20, height: 20 }}><Ico name="plus" /></span>
          </PlanCreate>
          <button type="button" className="cc-iconbtn" data-variant="ghost" aria-label="Menu" onClick={() => setOpen(true)}>
            <span style={{ width: 20, height: 20 }}><Ico name="more" /></span>
          </button>
        </div>
      </header>

      {open ? (
        <div
          className="lg:hidden"
          style={{ position: "fixed", inset: 0, zIndex: 60 }}
          onClick={() => setOpen(false)}
        >
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,16,10,.32)" }} />
          <div
            className="cc-overflow"
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: "calc(var(--space-6) + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cc-overflow-grip" />
            <div className="cc-overflow-id">
              <span className="cc-overflow-avatar">{initials}</span>
              <div>
                <div className="cc-overflow-name">{firstName}</div>
                <div className="cc-overflow-email">{email}</div>
              </div>
            </div>

            {overflowGroups.map((group) => (
              <div key={group.label} className="cc-overflow-group">
                <span className="cc-rail-group-label">{group.label}</span>
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className="cc-overflow-row" onClick={() => setOpen(false)}>
                    <span className="ic"><Ico name={item.icon} /></span>{item.label}
                  </Link>
                ))}
              </div>
            ))}
            {isStaff ? (
              <Link href="/settings" className="cc-overflow-row" data-staff="true" onClick={() => setOpen(false)}>
                <span className="ic"><Ico name="settings" /></span>Demo &amp; palette (staff)
              </Link>
            ) : null}
            <form action={signOut}>
              <button type="submit" className="cc-overflow-row" data-tone="quiet" style={{ width: "100%", background: "none", border: 0, borderTop: "1px solid var(--rule)", cursor: "pointer" }}>
                <span className="ic"><Ico name="exit" /></span>Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
