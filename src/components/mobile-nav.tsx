"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Route } from "next";
import { signOut } from "@/app/login/actions";

export function MobileNav({
  items,
  email,
}: {
  items: ReadonlyArray<{ href: Route; label: string }>;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change so tapping a link dismisses the menu.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock scroll while open + Esc to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost lg:hidden"
        style={{ padding: "9px 10px" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? (
            <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-ink/30" />
          {/* sheet */}
          <div
            className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-paper shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-rule px-4 py-3">
              <span className="brand-lockup" style={{ fontSize: 18 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M14.5 3.3a9 9 0 1 0 6.2 12.1A7 7 0 0 1 14.5 3.3Z"
                    fill="currentColor"
                    style={{ color: "var(--gold)" }}
                  />
                </svg>
                <span>
                  Khonser<span style={{ color: "var(--gold)" }}>a</span>
                </span>
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="btn-ghost"
                style={{ padding: "9px 10px" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 text-sm">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={active}
                    className="nav-tab block"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-rule p-3">
              <p className="tiny mb-2 truncate">{email}</p>
              <form action={signOut}>
                <button type="submit" className="btn-ghost w-full justify-center">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
