import Link from "next/link";
import { requireUserContext } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { DemoModeIndicator } from "@/components/demo-mode-indicator";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/visits", label: "Visits" },
  { href: "/itinerary", label: "Itinerary" },
  { href: "/customers", label: "Customers" },
  { href: "/locations", label: "Locations" },
  { href: "/expenses", label: "Expenses" },
  { href: "/settings", label: "Settings" },
] as const;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireUserContext();

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-6 border-r border-border bg-muted/30 p-4">
        <div>
          <p className="text-sm font-semibold">Journies</p>
          <p className="text-xs text-muted-foreground">{ctx.email}</p>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 hover:bg-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          {ctx.isStaff ? <DemoModeIndicator /> : null}
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md border border-border px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex flex-col">{children}</main>
    </div>
  );
}
