// View-models for the concierge contract components. These are presentational
// shapes decoupled from the DB rows (src/lib/types/database.ts) so screens map
// once and Design can restyle the components without touching data access.
// Names mirror the §3 component inventory / handover §4 data model.

export type Mode = "work" | "personal";

export type AnchorType =
  | "appointment"
  | "reservation"
  | "accommodation_check_in"
  | "accommodation_check_out"
  | "transport_arrival"
  | "flight"
  | "custom";

export type TimeWindow = { from: string; to?: string };

export type AnchorVM = {
  id: string;
  type: AnchorType;
  title: string;
  place?: string;
  time?: TimeWindow; // ISO strings; `to` present => window
  durationMinutes?: number;
  fixed?: boolean; // immovable hard point
};

export type IntentionVM = {
  id: string;
  description: string;
  target?: string; // e.g. "with customer by 09:00"
  bufferMinutes?: number;
  state: "active" | "toggled_off";
  flexibility: "soft" | "promoted_to_hard";
  leaveBy?: string; // back-calculated ISO
};

export type GapVM = {
  id: string;
  type: "transport_gap" | "accommodation_gap" | "unplanned_time" | "care_gap";
  fromLabel?: string;
  toLabel?: string;
  state: "open" | "watching" | "resolved" | "dismissed";
  prompt?: string; // the binary reveal / care nudge copy
};

export type LegMode =
  | "walk"
  | "drive"
  | "taxi"
  | "bus"
  | "tube"
  | "train"
  | "flight"
  | "mixed";

export type BookingStatus =
  | "synced"
  | "booked_in_app"
  | "manual"
  | "unbooked_stub";

export type LegVM = {
  id: string;
  mode: LegMode;
  fromLabel: string;
  toLabel: string;
  departure?: string;
  arrival?: string;
  cost?: number; // pence/cents minor units
  currency?: string;
  notes?: string;
  bookingStatus: BookingStatus;
};

// One scheduled-transport option in the §7 comparison (two bracket the target).
export type TransportOptionVM = {
  id: string;
  mode: LegMode;
  departure: string;
  arrival: string;
  deltaMinutes: number; // vs the intention target (− early, + late)
  changes: number;
  cost?: number;
  currency?: string;
};

export type JourneyVM = {
  id: string;
  title: string;
  mode: Mode;
  dateStart: string;
  dateEnd: string;
  status: string;
  anchorCount: number;
  openGapCount: number;
};

export type ContactVM = {
  id: string;
  name: string;
  channel?: "phone" | "email" | "whatsapp";
  detail?: string;
};

export type TaskVM = {
  id: string;
  title: string;
  due?: string;
  done: boolean;
};

export type ExpenseVM = {
  id: string;
  amount: number; // minor units
  currency: string;
  category?: string;
  date?: string;
};

export const GBP = "GBP";

export function formatMoney(minor: number, currency = GBP): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

export function formatClock(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDelta(minutes: number): string {
  if (minutes === 0) return "on time";
  const abs = Math.abs(minutes);
  return minutes < 0 ? `${abs}m early` : `${abs}m late`;
}
