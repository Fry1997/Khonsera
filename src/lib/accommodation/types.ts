// Structured accommodation model (ED1) — grounded in docs/research/accommodation.md and the entity
// catalogue. Stored on the accommodation stop's `metadata.accommodation` (JSONB), so no migration is
// needed and the channel/PMS fields can later power messaging/keys without a second migration.
//
// The bar (the rule): service the stay so completely the Hilton/Booking app is redundant. Our edge
// is the ARRIVAL PAYLOAD — what you need on the day — which we surface better than the operator apps.

export type BoardBasis = "room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive";

export type BookingChannel =
  | "direct"
  | "booking_com"
  | "expedia"
  | "hotelbeds"
  | "airbnb"
  | "other";

export type AccommodationDetails = {
  // Property
  property_name?: string | null;
  brand?: string | null; // chain (Hilton, Marriott…) — drives the deep-link target
  phone?: string | null; // one-tap "hold my room, running late"
  // Stay window (constraints, not fixed points) — the stop's start/end carry the ISO times
  guests?: number | null;
  rooms?: number | null;
  // Room & rate
  room_type?: string | null;
  board_basis?: BoardBasis | null;
  breakfast_window?: string | null; // free text e.g. "07:00–10:30" — feeds the morning leave-by
  // Money
  price?: string | null;
  currency?: string | null;
  prepaid?: boolean | null;
  // Booking channel (the handle for future manage/message/cancel)
  channel?: BookingChannel | null;
  confirmation_ref?: string | null;
  loyalty_no?: string | null;
  // Arrival payload (the winnable edge — what you need on the day)
  check_in_method?: string | null; // "front desk" | "lockbox 4821" | "app key"
  access_instructions?: string | null;
  wifi_ssid?: string | null;
  wifi_password?: string | null;
  parking_info?: string | null;
  cancellation_policy?: string | null;
  free_cancel_until?: string | null; // ISO — a readiness + decision-clock item
};

export const BOARD_LABELS: Record<BoardBasis, string> = {
  room_only: "Room only",
  breakfast: "Breakfast included",
  half_board: "Half board",
  full_board: "Full board",
  all_inclusive: "All inclusive",
};

export const CHANNEL_LABELS: Record<BookingChannel, string> = {
  direct: "Direct",
  booking_com: "Booking.com",
  expedia: "Expedia",
  hotelbeds: "Hotelbeds",
  airbnb: "Airbnb",
  other: "Other",
};

// Read the structured details off a stop's metadata, tolerating legacy/empty rows.
export function accommodationFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): AccommodationDetails | null {
  if (!metadata || typeof metadata !== "object") return null;
  const a = (metadata as Record<string, unknown>).accommodation;
  if (!a || typeof a !== "object") return null;
  return a as AccommodationDetails;
}

// True when the stay carries anything beyond the bare window — used to decide whether to render the
// rich arrival card vs a plain stay row.
export function hasAccommodationDetail(d: AccommodationDetails | null): boolean {
  if (!d) return false;
  return Boolean(
    d.property_name || d.confirmation_ref || d.room_type || d.check_in_method ||
    d.access_instructions || d.wifi_ssid || d.parking_info || d.cancellation_policy ||
    d.phone || d.board_basis || d.price,
  );
}
