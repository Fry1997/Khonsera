"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { PlanCreate } from "@/components/plan/plan-create";
import type { AppMode } from "@/lib/mode";
import {
  mobileOverflowNavigation,
  navigationGlyphs,
  type NavigationIcon,
} from "@/lib/navigation";

// Mobile instrument header: compact wordmark + signal dot, one create action
// and the overflow. Secondary destinations stay in the sheet so the lockup and
// primary action retain clear touch targets on narrow screens.

function Ico({ name }: { name: NavigationIcon }) {
  return (
    <svg
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
          <Link
            href="/today"
            className="cc-lockup"
            data-compact="true"
            aria-label="Khonsera"
          >
            <span className="cc-brand-dot" aria-hidden />
            <span className="wm">KHONSERA</span>
          </Link>
        </div>
        <div className="cc-appbar-right">
          <PlanCreate className="cc-iconbtn" title="Plan a day">
            <span className="cc-appbar-icon">
              <Ico name="plus" />
            </span>
          </PlanCreate>
          <button
            type="button"
            className="cc-iconbtn"
            data-variant="ghost"
            aria-label="Menu"
            onClick={() => setOpen(true)}
          >
            <span className="cc-appbar-icon">
              <Ico name="more" />
            </span>
          </button>
        </div>
      </header>

      {open ? (
        <div
          className="cc-overflow-layer lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div className="cc-overflow-scrim" />
          <div className="cc-overflow" onClick={(e) => e.stopPropagation()}>
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
                  <Link
                    key={item.href}
                    href={item.href}
                    className="cc-overflow-row"
                    onClick={() => setOpen(false)}
                  >
                    <span className="ic">
                      <Ico name={item.icon} />
                    </span>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
            {isStaff ? (
              <Link
                href="/settings"
                className="cc-overflow-row"
                data-staff="true"
                onClick={() => setOpen(false)}
              >
                <span className="ic">
                  <Ico name="settings" />
                </span>
                Demo &amp; palette (staff)
              </Link>
            ) : null}
            <form action={signOut}>
              <button
                type="submit"
                className="cc-overflow-row cc-overflow-signout"
                data-tone="quiet"
              >
                <span className="ic">
                  <Ico name="exit" />
                </span>
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
