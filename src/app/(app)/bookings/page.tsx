import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { BookingsFilter } from "./bookings-filter";

type SegmentRow = {
  id: string;
  sequence: number;
  from_location_name: string;
  to_location_name: string;
  departure_at: string;
  arrival_at: string;
  train_number: string | null;
  platform_dep: string | null;
  platform_arr: string | null;
};

type BookingRow = {
  id: string;
  provider: string | null;
  booking_reference: string | null;
  ticket_status: string;
  actual_price: number | null;
  currency: string;
  booked_at: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  seat_reservation: string | null;
  booking_intent: {
    id: string;
    itinerary_id: string | null;
    stop_id: string | null;
    itinerary: {
      id: string;
      title: string | null;
      date_start: string;
    } | null;
  } | null;
  departure_location: { id: string; name: string } | null;
  arrival_location: { id: string; name: string } | null;
  segments: SegmentRow[];
};

type Bucket = "all" | "rail" | "flights" | "stays" | "cars";

const BUCKET_LABEL: Record<Bucket, string> = {
  all: "All",
  rail: "Rail",
  flights: "Flights",
  stays: "Stays",
  cars: "Cars",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const bucket: Bucket = isBucket(filter) ? filter : "all";

  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const { data: rawBookings } = await supabase
    .from("travel_bookings")
    .select(
      `id, provider, booking_reference, ticket_status, actual_price, currency,
       booked_at, departure_at, arrival_at, seat_reservation,
       booking_intent:booking_intents(
         id, itinerary_id, stop_id,
         itinerary:itineraries(id, title, date_start)
       ),
       departure_location:locations!travel_bookings_departure_location_id_fkey(id, name),
       arrival_location:locations!travel_bookings_arrival_location_id_fkey(id, name),
       segments:travel_booking_segments(
         id, sequence, from_location_name, to_location_name, departure_at,
         arrival_at, train_number, platform_dep, platform_arr
       )`,
    )
    .eq("workspace_id", ctx.workspaceId)
    .order("booked_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const bookings = (rawBookings ?? []) as unknown as BookingRow[];
  const filtered = bookings.filter((b) => matchesBucket(b, bucket));

  // Pick the most recent in-flight itinerary so the "New booking" CTA can
  // jump straight into its editor.
  const { data: latestItinerary } = await supabase
    .from("itineraries")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .in("status", ["draft", "planning", "planned", "in_progress"])
    .order("date_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const buckets: Bucket[] = ["all", "rail", "flights", "stays", "cars"];
  const counts = Object.fromEntries(
    buckets.map((b) => [b, bookings.filter((x) => matchesBucket(x, b)).length]),
  ) as Record<Bucket, number>;

  const now = Date.now();
  const upcoming = filtered.filter((b) => {
    const ts = b.departure_at ?? b.booked_at;
    return !ts || new Date(ts).getTime() >= now;
  });
  const past = filtered.filter((b) => !upcoming.includes(b));

  return (
    <PageShell
      title="Bookings"
      description="Every ticket, hotel and hire car you've recorded — kept in one place across all your itineraries."
      actions={
        latestItinerary ? (
          <Link href={`/itineraries/${latestItinerary.id}`} className="btn-gold">
            + New booking
          </Link>
        ) : (
          <Link href="/itineraries/new" className="btn-gold">
            + Start an itinerary
          </Link>
        )
      }
    >
      <BookingsFilter active={bucket} counts={counts} labels={BUCKET_LABEL} />

      {filtered.length === 0 ? (
        <div className="k-card-soft p-8 text-center">
          <p className="body mb-1">
            No {bucket === "all" ? "" : BUCKET_LABEL[bucket].toLowerCase() + " "}
            bookings yet.
          </p>
          <p className="small">
            Bookings appear here as you confirm tickets, hotels and hire cars
            against an itinerary. Open an itinerary and use{" "}
            <span className="font-medium">+ Add booking</span> on any point to
            capture one.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <section className="flex flex-col gap-3">
              <header className="flex items-baseline justify-between">
                <h2 className="h3 uc" style={{ letterSpacing: "0.14em" }}>
                  Upcoming
                </h2>
                <span className="small mono">{upcoming.length} ·</span>
              </header>
              <div className="flex flex-col gap-3">
                {upcoming.map((b) => (
                  <BookingCard key={b.id} booking={b} timezone={wsCfg.timezone} />
                ))}
              </div>
            </section>
          ) : null}

          {past.length > 0 ? (
            <section className="flex flex-col gap-3">
              <header className="flex items-baseline justify-between">
                <h2 className="h3 uc" style={{ letterSpacing: "0.14em" }}>
                  Past
                </h2>
                <span className="small mono">{past.length}</span>
              </header>
              <div className="flex flex-col gap-3">
                {past.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    timezone={wsCfg.timezone}
                    past
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </PageShell>
  );
}

function isBucket(v?: string): v is Bucket {
  return v === "all" || v === "rail" || v === "flights" || v === "stays" || v === "cars";
}

function bucketForBooking(b: BookingRow): Bucket {
  const p = (b.provider ?? "").toLowerCase();
  if (p.includes("hotel") || p.includes("booking.com") || p.includes("airbnb")) return "stays";
  if (p.includes("trainline") || p.includes("rail") || p.includes("avanti") || p.includes("gwr") || p.includes("lner") || p.includes("tfl") || p.includes("tube")) return "rail";
  if (p.includes("airline") || p.includes("ba") || p.includes("klm") || p.includes("flight") || p.includes("ryan") || p.includes("easy")) return "flights";
  if (p.includes("car-hire") || p.includes("hertz") || p.includes("avis") || p.includes("enterprise") || p.includes("sixt")) return "cars";
  // Fall back to segment heuristics — flight codes typically two letters + digits.
  const first = b.segments?.[0];
  if (first?.train_number && /^[A-Z]{2}\d{1,5}$/i.test(first.train_number)) {
    return "flights";
  }
  if (first?.platform_dep && /^\d{1,3}$/.test(first.platform_dep)) return "rail";
  return "all";
}

function matchesBucket(b: BookingRow, bucket: Bucket): boolean {
  if (bucket === "all") return true;
  return bucketForBooking(b) === bucket;
}

function BookingCard({
  booking,
  timezone,
  past,
}: {
  booking: BookingRow;
  timezone: string;
  past?: boolean;
}) {
  const bucket = bucketForBooking(booking);
  const isStay = bucket === "stays";
  const isFlight = bucket === "flights";
  const isCar = bucket === "cars";

  const fromName =
    booking.segments?.[0]?.from_location_name ??
    booking.departure_location?.name ??
    "—";
  const toName =
    booking.segments?.[booking.segments.length - 1]?.to_location_name ??
    booking.arrival_location?.name ??
    "—";

  const lineEyebrow = isStay
    ? "Stay"
    : isFlight
      ? "Flight"
      : isCar
        ? "Car hire"
        : bucket === "rail"
          ? "Rail"
          : "Booking";

  return (
    <article
      className="k-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
      data-past={past}
      style={past ? { opacity: 0.78 } : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="uc">{lineEyebrow}</span>
          {booking.provider ? (
            <span className="mono text-xs" style={{ color: "var(--ink-faint)" }}>
              · {booking.provider}
            </span>
          ) : null}
          <BookingStatusPill status={booking.ticket_status} />
        </div>
        <h3
          className="serif-i text-[19px]"
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            color: "var(--ink)",
          }}
        >
          {isStay ? (
            <>{booking.arrival_location?.name ?? fromName}</>
          ) : (
            <>
              {fromName} <span style={{ color: "var(--ink-faint)" }}>→</span>{" "}
              {toName}
            </>
          )}
        </h3>
        <p className="small mono">
          {booking.departure_at ? fmtDateTime(booking.departure_at, timezone) : "—"}
          {booking.arrival_at
            ? ` · ${
                isStay ? "→ " : ""
              }${fmtDateTime(booking.arrival_at, timezone)}`
            : ""}
        </p>
        {booking.segments?.length > 1 ? (
          <p className="small">
            Via{" "}
            {booking.segments
              .slice(0, -1)
              .map((s) => s.to_location_name)
              .join(", ")}
          </p>
        ) : null}
        {booking.seat_reservation ? (
          <p className="small">
            {isStay ? "Room: " : isCar ? "" : "Seat: "}
            {booking.seat_reservation}
          </p>
        ) : null}
        {booking.booking_intent?.itinerary ? (
          <p className="small">
            <Link
              className="action-link"
              href={`/itineraries/${booking.booking_intent.itinerary.id}`}
              style={{ padding: 0 }}
            >
              {booking.booking_intent.itinerary.title ??
                fmtDate(booking.booking_intent.itinerary.date_start, timezone)}
            </Link>
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-row items-baseline gap-4 sm:flex-col sm:items-end sm:gap-1">
        {booking.actual_price != null ? (
          <span
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 22,
              color: "var(--ink)",
            }}
          >
            {fmtMoney(Number(booking.actual_price), booking.currency)}
          </span>
        ) : (
          <span className="small">—</span>
        )}
        {booking.booking_reference ? (
          <span className="mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
            Ref · {booking.booking_reference}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function BookingStatusPill({ status }: { status: string }) {
  const cls =
    status === "booked"
      ? "sb sb-booked"
      : status === "cancelled" || status === "refunded"
        ? "sb sb-cancelled"
        : "sb sb-done";
  return <span className={cls}>{status}</span>;
}

function fmtMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function fmtDateTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}

function fmtDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: tz,
  }).format(new Date(iso));
}
