import { KhonseraBrand } from "./khonsera-brand";
import { MobileNav } from "./mobile-nav";
import { DemoModeIndicator } from "./demo-mode-indicator";
import type { Route } from "next";

const NAV = [
  { href: "/dashboard" as Route, label: "Today" },
  { href: "/itineraries" as Route, label: "Itineraries" },
  { href: "/bookings" as Route, label: "Bookings" },
  { href: "/flights" as Route, label: "Flights" },
  { href: "/customers" as Route, label: "Customers" },
  { href: "/locations" as Route, label: "Locations" },
  { href: "/expenses" as Route, label: "Expenses" },
  { href: "/settings" as Route, label: "Settings" },
] as const;

// Server component — DemoModeIndicator needs server-only cookies(), so
// composing it here is the right place. The MobileNav inside is a client
// component and works fine being nested.
export async function MobileTopbar({
  email,
  isStaff,
}: {
  email: string;
  isStaff: boolean;
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
        {isStaff ? <DemoModeIndicator /> : null}
        <MobileNav items={NAV} email={email} />
      </div>
    </header>
  );
}
