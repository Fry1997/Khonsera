import type { AnchorType, TicketVM } from "@/components/concierge";
import type { NavMode } from "@/lib/nav/types";
import type { Route } from "next";

export interface SpinePass {
  ticket: TicketVM;
  crs: string | null;
  time: string | null;
  dest: string | null;
}

export type StationKind = "rail_station" | "airport";
export type AnchorRole = "departure" | "arrival" | "changeover" | "stop";
export type TransitionProgressState = "planned" | "live" | "done" | "cancelled";

export interface SpineAnchor {
  id: string;
  type: AnchorType;
  title: string;
  place?: string;
  arriveByIso: string | null;
  endIso: string | null;
  coord: { lat: number; lng: number } | null;
  plannedTravelMinutes: number | null;
  /** Optional per-boundary preferred margin used by the leave-by engine. */
  bufferMinutes?: number | null;
  /** A preceding fixed span (for example a shift) prevents departure before this. */
  notBeforeIso?: string | null;
  /** Original transition mode before it is adapted for the routing UI. */
  travelMode?: string | null;
  /** Transition into this anchor, used for persisted on-the-way / arrival state. */
  inboundTransitionId?: string | null;
  transitionState?: TransitionProgressState | null;
  actualStartedAt?: string | null;
  actualArrivedAt?: string | null;
  navMode: NavMode;
  station: { name: string; code: string | null; kind: StationKind } | null;
  role: AnchorRole;
  mode?: "work" | "personal" | null;
  pass?: SpinePass | null;
  /** Routing context such as the home bookend: render its movement, never a stop card. */
  contextOnly?: boolean;
}

export function stationLabel(name: string, kind: StationKind): string {
  if (/\b(station|airport|international|terminal|parkway|airfield|interchange)\b/i.test(name)) return name;
  return `${name} ${kind === "airport" ? "Airport" : "Station"}`;
}

export function roleLabel(role: AnchorRole, station: SpineAnchor["station"]): string {
  switch (role) {
    case "departure": return "Departure";
    case "arrival": return "Arrival";
    case "changeover": return "Change";
    default: return station ? (station.kind === "airport" ? "Airport" : "Station") : "Stop";
  }
}

export function roleOf(rawType: string): AnchorRole {
  if (rawType.includes("departure")) return "departure";
  if (rawType.includes("changeover")) return "changeover";
  if (rawType.includes("arrival")) return "arrival";
  return "stop";
}

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

export function navigateHref(a: { coord: { lat: number; lng: number } | null; title: string; role?: AnchorRole }): Route | null {
  if (!a.coord || a.role === "arrival" || a.role === "changeover") return null;
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
