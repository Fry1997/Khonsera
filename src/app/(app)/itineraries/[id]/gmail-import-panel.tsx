"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scanGmailForBookings, markBookingImported } from "@/lib/actions/gmail";
import { attachTransportBookingToStop } from "@/lib/actions/bookings";
import { attachAccommodationBooking } from "@/lib/actions/bookings";
import { feedbackFromError } from "@/lib/actions/_form";
import { SubmitButton } from "@/components/ui/form";
import { TrainTicketGroup, type TicketSegment } from "@/components/train-ticket-card";
import type {
  ParsedBooking,
  ParsedTransportBooking,
  ParsedAccommodationBooking,
} from "@/lib/gmail/types";

function TransportBookingCard({
  booking,
  onImport,
  importing,
}: {
  booking: ParsedTransportBooking;
  onImport: () => void;
  importing: boolean;
}) {
  const first = booking.segments[0];
  const last = booking.segments[booking.segments.length - 1];
  const modeLabel =
    booking.mode === "train"
      ? "Train"
      : booking.mode === "flight"
        ? "Flight"
        : "Bus";
  const modeColor =
    booking.mode === "train"
      ? "var(--gold-2)"
      : booking.mode === "flight"
        ? "var(--terra)"
        : "var(--sage)";

  const ticketSegments: TicketSegment[] = booking.segments.map((seg) => ({
    from_station: seg.from_station,
    to_station: seg.to_station,
    from_station_code: seg.from_station_code,
    to_station_code: seg.to_station_code,
    departure_date: seg.departure_date,
    departure_time: seg.departure_time,
    arrival_time: seg.arrival_time,
    operator: seg.operator,
    route_restriction: seg.route_restriction,
    ticket_type: seg.ticket_type,
    coach: seg.coach,
    seat: seg.seat,
    barcode_ref: seg.barcode_ref,
    barcode_data: seg.barcode_data,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{ background: modeColor, color: "var(--card)" }}
          >
            {modeLabel}
          </span>
          <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
            {booking.provider}
          </span>
          {booking.is_amendment ? (
            <span
              className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{ background: "var(--rust)", color: "var(--card)" }}
            >
              Amendment
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn-terra"
          style={{ padding: "4px 12px", fontSize: 12, borderRadius: 8 }}
          onClick={onImport}
          disabled={importing}
        >
          {importing ? "Importing..." : "Import"}
        </button>
      </div>

      <TrainTicketGroup
        segments={ticketSegments}
        bookingRef={booking.booking_reference}
        totalPrice={booking.price}
      />
    </div>
  );
}

function AccommodationBookingCard({
  booking,
  onImport,
  importing,
}: {
  booking: ParsedAccommodationBooking;
  onImport: () => void;
  importing: boolean;
}) {
  return (
    <div className="j-card flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{ background: "var(--sage)", color: "var(--card)" }}
          >
            Hotel
          </span>
          <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
            {booking.provider}
          </span>
          {booking.is_amendment ? (
            <span
              className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{ background: "var(--rust)", color: "var(--card)" }}
            >
              Amendment
            </span>
          ) : null}
        </div>
        <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
          {new Date(booking.email_date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>

      <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
        {booking.hotel_name}
      </p>

      <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
        Check-in: {booking.check_in_date}
        {booking.check_in_time ? ` from ${booking.check_in_time}` : ""}
        {" · "}
        Check-out: {booking.check_out_date}
        {booking.check_out_time ? ` by ${booking.check_out_time}` : ""}
      </p>

      {booking.room_details ? (
        <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
          Room: {booking.room_details}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs" style={{ color: "var(--ink-dim)" }}>
          {booking.booking_reference ? (
            <span>Ref: {booking.booking_reference}</span>
          ) : null}
          {booking.price != null ? (
            <span>
              {booking.currency === "GBP"
                ? "£"
                : booking.currency === "EUR"
                  ? "€"
                  : "$"}
              {booking.price.toFixed(2)}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn-terra"
          style={{ padding: "4px 12px", fontSize: 12 }}
          onClick={onImport}
          disabled={importing}
        >
          {importing ? "Importing..." : "Import"}
        </button>
      </div>
    </div>
  );
}

export function GmailImportPanel({
  itineraryId,
  lastStopId,
  lastStopLabel,
  onClose,
  onImported,
}: {
  itineraryId: string;
  lastStopId: string | null;
  lastStopLabel: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const router = useRouter();
  const [scanning, startScan] = useTransition();
  const [importing, startImport] = useTransition();
  const [bookings, setBookings] = useState<ParsedBooking[] | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  const doScan = () => {
    setError(null);
    startScan(async () => {
      const result = await scanGmailForBookings();
      if (!result.ok) {
        setError(
          result.error.kind === "integration"
            ? result.error.reason
            : "Failed to scan Gmail",
        );
        return;
      }
      setBookings(result.value.bookings);
      setScannedCount(result.value.scanned_count);
    });
  };

  const doImportTransport = async (
    booking: ParsedTransportBooking,
    stopId: string,
  ): Promise<boolean> => {
    const first = booking.segments[0];
    const last = booking.segments[booking.segments.length - 1];

    const segments = booking.segments.map((seg) => ({
      from_location_name: seg.from_station,
      to_location_name: seg.to_station,
      departure_at: new Date(
        `${seg.departure_date}T${seg.departure_time}:00`,
      ).toISOString(),
      arrival_at: new Date(
        `${seg.arrival_date}T${seg.arrival_time || seg.departure_time}:00`,
      ).toISOString(),
      service_number: seg.service_number ?? null,
      platform_dep: seg.platform_dep ?? null,
      platform_arr: seg.platform_arr ?? null,
      from_station_code: seg.from_station_code ?? null,
      to_station_code: seg.to_station_code ?? null,
      operator: seg.operator ?? null,
      ticket_type: seg.ticket_type ?? null,
      route_restriction: seg.route_restriction ?? null,
      coach: seg.coach ?? null,
      seat: seg.seat ?? null,
      barcode_ref: seg.barcode_ref ?? null,
      barcode_data: seg.barcode_data ?? null,
    }));

    const result = await attachTransportBookingToStop({
      from_stop_id: stopId,
      mode: booking.mode,
      provider: booking.provider,
      arrival_location_id: null,
      arrival_location_name: last?.to_station ?? "Unknown",
      arrival_location_type: "station",
      booking_reference: booking.booking_reference,
      actual_price: booking.price,
      currency: booking.currency,
      seat_reservation: first?.seat ?? null,
      gmail_message_id: booking.gmail_message_id,
      segments,
    });

    if (!result.ok) {
      setError(feedbackFromError(result.error).message);
      return false;
    }

    await markBookingImported({
      gmail_message_id: booking.gmail_message_id,
      booking_type: "transport",
      travel_booking_id: result.value.travel_booking_id,
    });

    setImportedIds((prev) => new Set(prev).add(booking.gmail_message_id));
    return true;
  };

  const doImportAccommodation = async (
    booking: ParsedAccommodationBooking,
  ): Promise<boolean> => {
    const checkIn = booking.check_in_time
      ? new Date(
          `${booking.check_in_date}T${booking.check_in_time}:00`,
        ).toISOString()
      : new Date(`${booking.check_in_date}T15:00:00`).toISOString();
    const checkOut = booking.check_out_time
      ? new Date(
          `${booking.check_out_date}T${booking.check_out_time}:00`,
        ).toISOString()
      : new Date(`${booking.check_out_date}T11:00:00`).toISOString();

    const result = await attachAccommodationBooking({
      stop_id: null,
      after_stop_id: lastStopId,
      hotel_location_id: null,
      hotel_name: booking.hotel_name,
      check_in: checkIn,
      check_out: checkOut,
      provider: booking.provider,
      booking_reference: booking.booking_reference,
      actual_price: booking.price,
      currency: booking.currency,
      room_details: booking.room_details,
    });

    if (!result.ok) {
      setError(feedbackFromError(result.error).message);
      return false;
    }

    await markBookingImported({
      gmail_message_id: booking.gmail_message_id,
      booking_type: "accommodation",
      travel_booking_id: result.value.travel_booking_id,
    });

    setImportedIds((prev) => new Set(prev).add(booking.gmail_message_id));
    return true;
  };

  const handleImportOne = (booking: ParsedBooking) => {
    if (booking.type === "transport" && !lastStopId) {
      setError("Add at least one stop to the itinerary before importing transport bookings.");
      return;
    }
    setImportingId(booking.gmail_message_id);
    startImport(async () => {
      const ok =
        booking.type === "transport"
          ? await doImportTransport(booking, lastStopId!)
          : await doImportAccommodation(booking);
      setImportingId(null);
      if (ok) onImported();
    });
  };

  const handleImportAll = () => {
    if (!pending || pending.length === 0) return;
    const hasTransport = pending.some((b) => b.type === "transport");
    if (hasTransport && !lastStopId) {
      setError("Add at least one stop to the itinerary before importing transport bookings.");
      return;
    }
    setImportingId("__all__");
    startImport(async () => {
      let imported = 0;
      for (const booking of pending) {
        const ok =
          booking.type === "transport"
            ? await doImportTransport(booking, lastStopId!)
            : await doImportAccommodation(booking);
        if (ok) imported++;
        else break;
      }
      setImportingId(null);
      if (imported > 0) onImported();
    });
  };

  const pending = bookings?.filter(
    (b) => !importedIds.has(b.gmail_message_id),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mt-12 w-full max-w-xl overflow-y-auto rounded-lg border border-rule bg-card shadow-xl"
        style={{ maxHeight: "calc(100vh - 6rem)" }}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <div>
            <h2 className="h3">Import from Gmail</h2>
            <p className="small mt-0.5" style={{ color: "var(--ink-dim)" }}>
              Scan for upcoming booking confirmations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs hover:underline"
            style={{ color: "var(--ink-dim)" }}
          >
            Close
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {!bookings ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="small text-center" style={{ color: "var(--ink-dim)" }}>
                Scans your Gmail for upcoming booking confirmations from
                Trainline, LNER, Avanti, GWR, airlines, Booking.com,
                Hotels.com, Airbnb, and more. Past trips are excluded.
              </p>
              <SubmitButton
                pending={scanning}
                onClick={doScan}
                type="button"
              >
                Scan Gmail
              </SubmitButton>
            </div>
          ) : pending && pending.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <p className="small" style={{ color: "var(--ink-dim)" }}>
                  {pending.length} upcoming booking
                  {pending.length !== 1 ? "s" : ""} found
                  {importedIds.size > 0
                    ? ` · ${importedIds.size} imported`
                    : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={doScan}
                    disabled={scanning || importing}
                  >
                    {scanning ? "Rescanning..." : "Rescan"}
                  </button>
                  <button
                    type="button"
                    className="btn-terra"
                    style={{ padding: "4px 12px", fontSize: 12 }}
                    onClick={handleImportAll}
                    disabled={importing || pending.length === 0}
                  >
                    {importingId === "__all__"
                      ? "Importing..."
                      : `Import all (${pending.length})`}
                  </button>
                </div>
              </div>
              {pending.map((booking) => {
                const isImporting =
                  importingId === booking.gmail_message_id ||
                  importingId === "__all__";
                return booking.type === "transport" ? (
                  <TransportBookingCard
                    key={booking.gmail_message_id}
                    booking={booking}
                    onImport={() => handleImportOne(booking)}
                    importing={isImporting}
                  />
                ) : (
                  <AccommodationBookingCard
                    key={booking.gmail_message_id}
                    booking={booking}
                    onImport={() => handleImportOne(booking)}
                    importing={isImporting}
                  />
                );
              })}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              {bookings.length === 0 ? (
                <p className="small text-center" style={{ color: "var(--ink-dim)" }}>
                  No upcoming bookings found. Past trips are excluded
                  automatically. Make sure your booking confirmations are in
                  the connected Gmail account.
                </p>
              ) : (
                <p className="small text-center" style={{ color: "var(--sage)" }}>
                  All {bookings.length} booking
                  {bookings.length !== 1 ? "s" : ""} imported.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={doScan}
                  disabled={scanning}
                >
                  {scanning ? "Rescanning..." : "Rescan"}
                </button>
                <button
                  type="button"
                  className="btn-terra"
                  style={{ fontSize: 12 }}
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {error ? (
            <p className="text-xs text-rust">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
