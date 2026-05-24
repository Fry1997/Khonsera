// Shared types for Gmail booking import.

export type ParsedTransportSegment = {
  from_station: string;
  to_station: string;
  from_station_code: string | null;
  to_station_code: string | null;
  departure_date: string; // YYYY-MM-DD
  departure_time: string; // HH:MM
  arrival_date: string; // YYYY-MM-DD
  arrival_time: string; // HH:MM
  service_number: string | null;
  operator: string | null;
  route_restriction: string | null;
  ticket_type: string | null;
  platform_dep: string | null;
  platform_arr: string | null;
  coach: string | null;
  seat: string | null;
  barcode_ref: string | null;
  barcode_data: string | null; // Full Aztec/barcode payload for regeneration
};

export type ParsedTransportBooking = {
  type: "transport";
  mode: "train" | "flight" | "bus";
  provider: string;
  booking_reference: string | null;
  price: number | null;
  currency: "GBP" | "EUR" | "USD";
  segments: ParsedTransportSegment[];
  is_amendment: boolean;
  raw_subject: string;
  gmail_message_id: string;
  email_date: string;
};

export type ParsedAccommodationBooking = {
  type: "accommodation";
  hotel_name: string;
  provider: string;
  booking_reference: string | null;
  check_in_date: string; // YYYY-MM-DD
  check_in_time: string | null; // HH:MM
  check_out_date: string; // YYYY-MM-DD
  check_out_time: string | null; // HH:MM
  price: number | null;
  currency: "GBP" | "EUR" | "USD";
  room_details: string | null;
  is_amendment: boolean;
  raw_subject: string;
  gmail_message_id: string;
  email_date: string;
};

export type ParsedBooking = ParsedTransportBooking | ParsedAccommodationBooking;

export function getTravelDate(booking: ParsedBooking): string | null {
  if (booking.type === "transport") {
    return booking.segments[0]?.departure_date ?? null;
  }
  return booking.check_in_date ?? null;
}
