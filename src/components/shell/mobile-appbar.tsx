"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { signOut } from "@/app/login/actions";

// Mobile app shell header — Design Round 2 (`.cc-appbar`). The fix for the live
// pile-up: emblem-only lockup left (no wordmark → no "KHONSER" clip), exactly two
// quiet icon actions right (Tell + overflow). The mode toggle + secondary
// destinations live in the overflow sheet, so nothing crowds the logo.

const I = {
  plus: "M12 5v14M5 12h14",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  receipt: "M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2-1.5L5 21z M8 8h8M8 12h6",
  ticket: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2 M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1h-4a2 2 0 0 0 0 4h4 M16 12h.01",
  case: "M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M4 12h2M18 12h2M12 4v2M12 18v2M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18",
  tell: "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4z",
  navigate: "M3 11l19-9-9 19-2-8-8-2z",
  exit: "M16 17l5-5-5-5M21 12H9M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6",
} as const;

function Ico({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function MobileAppbar({
  email,
  firstName,
  initials,
  isStaff,
}: {
  email: string;
  firstName: string;
  initials: string;
  isStaff: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="cc-appbar lg:hidden" data-scrolled="false">
        <div className="cc-appbar-left">
          <Link href={"/today" as Route} className="cc-lockup" data-compact="true" aria-label="Khonsera">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mk-ink.png" alt="" />
            <span className="wm">Khonsera</span>
          </Link>
        </div>
        <div className="cc-appbar-right">
          <Link href={"/itineraries/new" as Route} className="cc-iconbtn" data-variant="ghost" title="Plan a day">
            <span style={{ width: 20, height: 20 }}><Ico d={I.plus} /></span>
          </Link>
          <button type="button" className="cc-iconbtn" data-variant="ghost" aria-label="Menu" onClick={() => setOpen(true)}>
            <span style={{ width: 20, height: 20 }}><Ico d={I.more} /></span>
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

            <Link href={"/wallet" as Route} className="cc-overflow-row" onClick={() => setOpen(false)}>
              <span className="ic"><Ico d={I.ticket} /></span>Wallet
            </Link>
            <Link href={"/navigate" as Route} className="cc-overflow-row" onClick={() => setOpen(false)}>
              <span className="ic"><Ico d={I.navigate} /></span>Navigate
            </Link>
            <Link href={"/expenses" as Route} className="cc-overflow-row" onClick={() => setOpen(false)}>
              <span className="ic"><Ico d={I.receipt} /></span>Expenses
            </Link>
            <Link href={"/workspace" as Route} className="cc-overflow-row" onClick={() => setOpen(false)}>
              <span className="ic"><Ico d={I.case} /></span>Workspace
            </Link>
            <Link href={"/settings" as Route} className="cc-overflow-row" onClick={() => setOpen(false)}>
              <span className="ic"><Ico d={I.gear} /></span>Settings
            </Link>
            {isStaff ? (
              <Link href={"/settings" as Route} className="cc-overflow-row" data-staff="true" onClick={() => setOpen(false)}>
                <span className="ic"><Ico d={I.gear} /></span>Demo &amp; palette (staff)
              </Link>
            ) : null}
            <form action={signOut}>
              <button type="submit" className="cc-overflow-row" data-tone="quiet" style={{ width: "100%", background: "none", border: 0, borderTop: "1px solid var(--rule)", cursor: "pointer" }}>
                <span className="ic"><Ico d={I.exit} /></span>Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
