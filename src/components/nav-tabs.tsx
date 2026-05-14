"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

export function NavTabs({
  items,
}: {
  items: ReadonlyArray<{ href: Route; label: string }>;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active}
            className="nav-tab"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
