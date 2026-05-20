import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { NavTabs } from "./nav-tabs";
import { DemoModeIndicator } from "./demo-mode-indicator";
import { MobileNav } from "./mobile-nav";

export const APP_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/itineraries", label: "Itineraries" },
  { href: "/bookings", label: "Bookings" },
  { href: "/flights", label: "Flights" },
  { href: "/customers", label: "Customers" },
  { href: "/locations", label: "Locations" },
  { href: "/expenses", label: "Expenses" },
  { href: "/settings", label: "Settings" },
] as const;

export function BrandHeader({
  email,
  isStaff,
}: {
  email: string;
  isStaff: boolean;
}) {
  return (
    <header className="border-b border-rule bg-card">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 py-3.5 md:gap-6 md:px-6">
        <div className="flex min-w-0 items-center gap-4 md:gap-6">
          <Link
            href="/dashboard"
            className="brand-lockup shrink-0"
            aria-label="Khonsera home"
          >
            <KhonseraMoon />
            <span>
              Khonser<span style={{ color: "var(--gold)" }}>a</span>
            </span>
          </Link>
          {/* Tabs are desktop-only; mobile gets the hamburger below. */}
          <div className="hidden lg:block">
            <NavTabs items={APP_NAV} />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {isStaff ? <DemoModeIndicator /> : null}
          {/* Email chip + sign-out hidden on small screens; both available
              from the mobile nav drawer. */}
          <span
            className="chip hidden md:inline-flex"
            title={email}
          >
            <span className="dot" style={{ color: "var(--sage)" }} />
            {truncateEmail(email)}
          </span>
          <form action={signOut} className="hidden md:block">
            <button type="submit" className="btn-ghost">
              Sign out
            </button>
          </form>
          <MobileNav items={APP_NAV} email={email} />
        </div>
      </div>
    </header>
  );
}

function KhonseraMoon() {
  // A crescent moon glyph — Khonsu / Sera. The path is the difference of two
  // circles, drawn in gold so it threads with the wordmark.
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
      style={{ color: "var(--gold)" }}
    >
      <path
        d="M14.5 3.3a9 9 0 1 0 6.2 12.1A7 7 0 0 1 14.5 3.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function truncateEmail(email: string): string {
  if (email.length <= 28) return email;
  const [local, domain] = email.split("@");
  return `${local.slice(0, 14)}…@${domain}`;
}
