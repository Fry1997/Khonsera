import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { NavTabs } from "./nav-tabs";
import { DemoModeIndicator } from "./demo-mode-indicator";

export const APP_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/visits", label: "Visits" },
  { href: "/itinerary", label: "Itinerary" },
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
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-6 py-3.5">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="brand-glyph">
            Journies
          </Link>
          <NavTabs items={APP_NAV} />
        </div>
        <div className="flex items-center gap-3">
          {isStaff ? <DemoModeIndicator /> : null}
          <span className="chip" title={email}>
            <span className="dot" style={{ color: "var(--sage)" }} />
            {truncateEmail(email)}
          </span>
          <form action={signOut}>
            <button type="submit" className="btn-ghost">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function truncateEmail(email: string): string {
  if (email.length <= 28) return email;
  const [local, domain] = email.split("@");
  return `${local.slice(0, 14)}…@${domain}`;
}
