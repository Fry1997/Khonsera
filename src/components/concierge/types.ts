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

// The six visually-distinct kinds a variable can take (planner master brief §5.3).
export type AnchorVariableKind =
  | "precise" // a settled clock time
  | "approximate" // "~2", soft
  | "ranged" // "2–3"
  | "by-a-time" // "by 3", a ceiling
  | "maximise" // as long as possible, bounded by a constraint
  | "derived"; // engine-computed from the other two

// One of the three anchor variables (arrive-by · duration · leave-by).
export type AnchorVariable = {
  kind: AnchorVariableKind;
  iso?: string; // resolved clock value (arrive/leave) — ISO
  minutes?: number; // duration value
  display: string; // the rendered figure ("09:42", "~2pm", "as long as possible")
  bound?: string; // for maximise: the constraint that caps it ("last train 17:02")
};

export type AnchorVM = {
  id: string;
  type: AnchorType;
  title: string;
  place?: string;
  time?: TimeWindow; // ISO strings; `to` present => window
  durationMinutes?: number;
  fixed?: boolean; // immovable hard point
  // The three-variable model (§5.3). When present, the AnchorCard renders the
  // editable arrive-by / duration / leave-by triad; the third is `derived`.
  vars?: {
    arriveBy?: AnchorVariable;
    duration?: AnchorVariable;
    leaveBy?: AnchorVariable;
  };
};

export type AnchorVariableSlot = "arriveBy" | "duration" | "leaveBy";

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
  atRisk?: boolean; // engine flagged a tight/late connection (§5.9)
  riskNote?: string; // the calm one-line caution
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

// ---------------------------------------------------------------------------
// Booked-document family (planner master brief §6) — TicketCard / StatusStrip /
// BarcodePresenter / ScanView. A chosen leg/anchor resolves into one or more of
// these. Presentational VMs only; the engine/data layer maps real bookings in.
// ---------------------------------------------------------------------------

export type DocumentKind = "rail" | "air" | "stay" | "ground";

// Mode-aware barcode symbology — rail = Aztec, air = PDF417/QR, transit = QR.
export type BarcodeFormat = "aztec" | "pdf417" | "qr";

// StatusStrip status set (rail + air). `stale` = last-known shown offline.
export type TravelStatus =
  | "on_time"
  | "delayed"
  | "platform_change"
  | "gate_change"
  | "boarding"
  | "cancelled"
  | "stale";

export type StatusVM = {
  status: TravelStatus;
  label?: string; // copy override; otherwise derived from status
  detail?: string; // "+18 min" · "Platform 4 → 1" · "Gate B12"
  offline?: boolean; // render the stale marker (no signal at the barrier)
};

// Where a fact/document came from — governs trust + how much is pre-filled +
// what can refresh live (§4.5). Mirrors the capture front doors.
export type DocumentSource =
  | "typed"
  | "manual"
  | "forwarded"
  | "inbox"
  | "affiliate"
  | "wallet"
  | "ocr";

export type BarcodeVM = {
  format: BarcodeFormat;
  value: string; // payload (RSP Aztec for rail, etc.) — rendered by BarcodePresenter
  passengerLabel?: string; // "Adult 1" — the swipeable stack in ScanView
};

export type TicketStop = {
  place: string; // station / airport / property
  code?: string; // CRS / IATA
  time?: string; // ISO
  platform?: string; // platform · gate · terminal
};

export type TicketChange = {
  place: string;
  arrive?: string; // ISO
  depart?: string; // ISO
  transferMinutes?: number;
  platform?: string;
  tight?: boolean; // tight-connection flag → ties to the leg's at-risk state
};

// One journey within a booking. A return booking is TWO of these (outbound +
// inbound) → the booking-pair stepped by chevron in the TicketCard.
export type TicketLegVM = {
  id: string;
  origin: TicketStop;
  destination: TicketStop;
  durationMinutes?: number;
  changes?: TicketChange[];
  // rail / air detail
  coach?: string;
  seat?: string;
  travelClass?: string; // "Standard" · "Business"
  ticketType?: string; // Advance / Off-Peak / Anytime
  restrictions?: string;
  boardingTime?: string; // air — ISO
  boardingZone?: string; // air — "Zone 2"
  baggage?: string; // air
  barcodes?: BarcodeVM[]; // one per passenger
  status?: StatusVM;
};

export type TicketVM = {
  id: string;
  kind: DocumentKind;
  operator: string; // "LNER" · "easyJet" · "Premier Inn"
  operatorSecondary?: string; // second operator on a mixed-operator journey
  reference?: string; // 8-char collection / booking ref
  price?: number; // minor units
  currency?: string;
  source: DocumentSource;
  legs: TicketLegVM[]; // 1 = single · 2 = booking-pair (outbound + return)
  consequence?: string; // the live band: "this return → leave the museum by 16:10"
  // stay
  address?: string;
  checkIn?: string; // ISO
  checkOut?: string; // ISO
  roomType?: string;
  nights?: number;
  contact?: string;
};

// The Wallet orders within a date by *time-needed* — the moment the document is
// used, not booked (§7.1): rail = departure · air = boarding · stay = check-in.
export function ticketUseMoment(t: TicketVM): string | undefined {
  if (t.kind === "stay") return t.checkIn;
  const first = t.legs[0];
  if (!first) return undefined;
  if (t.kind === "air") return first.boardingTime ?? first.origin.time;
  return first.origin.time; // rail / ground = departure / pickup
}

export const STATUS_LABEL: Record<TravelStatus, string> = {
  on_time: "On time",
  delayed: "Delayed",
  platform_change: "Platform change",
  gate_change: "Gate change",
  boarding: "Boarding",
  cancelled: "Cancelled",
  stale: "Last known",
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
