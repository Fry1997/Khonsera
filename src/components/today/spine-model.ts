import type { AnchorType } from "@/components/concierge";
import type { NavMode } from "@/lib/nav/types";
import type { Route } from "next";

// Shared serialisable shape the Today spine + next-move card render from. Built
// server-side in today/page.tsx (one place that reads the DB), consumed by the
// client pieces — keeps coordinate/travel data flowing without re-querying.

export type StationKind = "rail_station" | "airport";
export type AnchorRole = "departure" | "arrival" | "changeover" | "stop";

export interface SpineAnchor {
  id: string;
  type: AnchorType;
  title: string;
  place?: string;
  arriveByIso: string | null;
  endIso: string | null;
  coord: { lat: number; lng: number } | null;
  // Travel time of the plan's leg INTO this anchor — the offline fallback when
  // live routing isn't reachable. Minutes.
  plannedTravelMinutes: number | null;
  // Nav mode for door-to-door routing to this anchor (from the leg's mode).
  navMode: NavMode;
  // Present when this stop is a transport hub — you walk to the STATION, not the
  // town. Its coordinate is the nav target and `title` is the station label.
  station: { name: string; code: string | null; kind: StationKind } | null;
  role: AnchorRole;
  // Per-item work/personal classification (the parent Event's tag). Shown as a
  // quiet ModeTag on appointment/reservation cards — never a lens or a toggle.
  mode?: "work" | "personal" | null;
}

// You don't walk to "Harpenden" — you walk to Harpenden Station. Append the
// right noun unless the hub name already carries one (St Pancras International,
// Luton Airport Parkway, …).
export function stationLabel(name: string, kind: StationKind): string {
  if (/\b(station|airport|international|terminal|parkway|airfield|interchange)\b/i.test(name)) {
    return name;
  }
  return `${name} ${kind === "airport" ? "Airport" : "Station"}`;
}

export function roleLabel(role: AnchorRole, station: SpineAnchor["station"]): string {
  switch (role) {
    case "departure":
      return "Departure";
    case "arrival":
      return "Arrival";
    case "changeover":
      return "Change";
    default:
      return station ? (station.kind === "airport" ? "Airport" : "Station") : "Stop";
  }
}

export function roleOf(rawType: string): AnchorRole {
  if (rawType.includes("departure")) return "departure";
  if (rawType.includes("changeover")) return "changeover";
  if (rawType.includes("arrival")) return "arrival";
  return "stop";
}

// Map a plan transition mode onto a door-nav costing. Transit modes (train,
// tube, bus) fall back to walking the door-to-door hop — the routing layer
// only does walk/cycle/drive until the transit adapter lands.
export function navModeForTransition(mode: string | null | undefined): NavMode {
  switch (mode) {
    case "drive":
    case "taxi":
    case "car":
      return "drive";
    case "cycle":
    case "bike":
    case "bicycle":
      return "cycle";
    default:
      return "walk";
  }
}

// The "take me there" deep link into /navigate, pre-filling the destination.
export function navigateHref(a: { coord: { lat: number; lng: number } | null; title: string }): Route | null {
  if (!a.coord) return null;
  const params = new URLSearchParams({
    dlat: String(a.coord.lat),
    dlng: String(a.coord.lng),
    dname: a.title,
  });
  return `/navigate?${params.toString()}` as Route;
}

export function londonClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
