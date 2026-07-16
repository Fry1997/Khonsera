import type { Route } from "next";
import type { AppMode } from "@/lib/mode";

export const navigationGlyphs = {
  today: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 8v4l3 2",
  plan: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 10h16M8 2v4M16 2v4",
  tasks: "M9 11l2.5 2.5L17 8 M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  people: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 4-7 8-7s8 3 8 7",
  clients: "M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6M9 12h6M9 16h4",
  wallet: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2 M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1h-4a2 2 0 0 0 0 4h4 M16 12h.01",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M4 12h2M18 12h2M12 4v2M12 18v2M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18",
  navigate: "M12 3l8 18-8-5-8 5z",
  mileage: "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M13.4 10.6L17 7 M4.5 16a8 8 0 1 1 15 0z",
  workspace: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16 M15 21V9h4a1 1 0 0 1 1 1v11 M4 21h17 M7.5 8h1M7.5 12h1M7.5 16h1M11 8h1M11 12h1M11 16h1",
  pastimes: "M10.5 4a1.5 1.5 0 1 1 3 0v1.5h2.5a1 1 0 0 1 1 1V10h1.5a1.5 1.5 0 1 1 0 3H17v3a1 1 0 0 1-1 1h-3v-1.5a1.5 1.5 0 1 0-3 0V17H7a1 1 0 0 1-1-1v-3H4.5a1.5 1.5 0 1 1 0-3H6V6.5a1 1 0 0 1 1-1h3.5z",
  exit: "M9 4H4v16h5 M16 17l5-5-5-5 M21 12H9",
  plus: "M12 5v14M5 12h14",
  more: "M5 12h.01M12 12h.01M19 12h.01",
} as const;

export type NavigationIcon = keyof typeof navigationGlyphs;
export type NavigationItem = { href: Route; label: string; icon: NavigationIcon };
export type NavigationGroup = { label: string; items: NavigationItem[] };

const personalPeople = { href: "/contacts" as Route, label: "People", icon: "people" as const };
const workPeople = { href: "/customers" as Route, label: "Clients", icon: "clients" as const };

export function peopleNavItem(mode: AppMode): NavigationItem {
  return mode === "work" ? workPeople : personalPeople;
}

export function primaryNavigation(mode: AppMode): NavigationItem[] {
  return [
    { href: "/today" as Route, label: "Today", icon: "today" },
    { href: "/plan" as Route, label: "Plan", icon: "plan" },
    { href: "/tasks" as Route, label: "Tasks", icon: "tasks" },
    { href: "/wallet" as Route, label: "Wallet", icon: "wallet" },
    { href: "/navigate" as Route, label: "Navigate", icon: "navigate" },
  ];
}

export function navFor(mode: AppMode): NavigationGroup[] {
  return [
    {
      label: "Day",
      items: [
        { href: "/today" as Route, label: "Today", icon: "today" },
        { href: "/plan" as Route, label: "Plan", icon: "plan" },
        { href: "/tasks" as Route, label: "Tasks", icon: "tasks" },
        peopleNavItem(mode),
        { href: "/wallet" as Route, label: "Wallet", icon: "wallet" },
      ],
    },
    {
      label: "Money & travel",
      items: [
        { href: "/navigate" as Route, label: "Navigate", icon: "navigate" },
        { href: "/expenses" as Route, label: "Expenses", icon: "receipt" },
        { href: "/mileage" as Route, label: "Mileage", icon: "mileage" },
      ],
    },
    { label: "Downtime", items: [{ href: "/pastimes" as Route, label: "Pastimes", icon: "pastimes" }] },
    {
      label: "Account",
      items: [
        ...(mode === "work" ? [{ href: "/workspace" as Route, label: "Workspace", icon: "workspace" } satisfies NavigationItem] : []),
        { href: "/settings" as Route, label: "Settings", icon: "settings" },
      ],
    },
  ];
}

export function mobileOverflowNavigation(mode: AppMode): NavigationGroup[] {
  const primaryHrefs = new Set(primaryNavigation(mode).map((item) => item.href));
  return navFor(mode)
    .map((group) => ({ ...group, items: group.items.filter((item) => !primaryHrefs.has(item.href)) }))
    .filter((group) => group.items.length > 0);
}

export function isActiveNav(pathname: string, href: Route): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
