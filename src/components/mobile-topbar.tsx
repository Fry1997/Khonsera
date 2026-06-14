import { KhonseraBrand } from "./khonsera-brand";
import { MobileNav } from "./mobile-nav";
import type { Route } from "next";

// The "more" menu behind the topbar — the 4 primary destinations live in the
// bottom tab bar; this carries the secondary ones.
const MORE = [
  { href: "/expenses" as Route, label: "Expenses" },
  { href: "/workspace" as Route, label: "Workspace" },
  { href: "/settings" as Route, label: "Settings" },
] as const;

// Mobile topbar — emblem + wordmark on the left, the mode toggle + a quiet
// "more" trigger on the right. Two groups, justify-between, so the toggle never
// collides with the logo (the Round-2 fix). Sticky.
export async function MobileTopbar({
  email,
}: {
  email: string;
  isStaff?: boolean;
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
        gap: 12,
        padding: "10px 16px",
        background: "var(--paper)",
        borderBottom: "1px solid var(--rule)",
        minHeight: 52,
      }}
    >
      <KhonseraBrand size="sm" />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
        <MobileNav items={MORE} email={email} />
      </div>
    </header>
  );
}
