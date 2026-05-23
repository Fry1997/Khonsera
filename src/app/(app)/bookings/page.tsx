import Link from "next/link";
import type { Route } from "next";
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
    itinerary: { id: string; title: string | null; date_start: string } | null;
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
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
            Wallet
          </span>
          <h1 className="desk-h1" style={{ marginTop: 6, fontSize: "clamp(28px, 4vw, 38px)" }}>
            Bookings.
          </h1>
          <p
            className="serif-i"
            style={{
              fontSize: 16,
              color: "var(--ink-dim)",
              margin: "8px 0 0",
              maxWidth: "60ch",
            }}
          >
            Every ticket, where you left it.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {latestItinerary ? (
            <Link
              href={`/itineraries/${latestItinerary.id}`}
              className="btn btn-gold"
            >
              <Plus /> New booking
            </Link>
          ) : (
            <Link
              href={"/itineraries/new" as Route}
              className="btn btn-gold"
            >
              <Plus /> Start an itinerary
            </Link>
          )}
        </div>
      </header>

      <BookingsFilter active={bucket} counts={counts} labels={BUCKET_LABEL} />

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p
            className="serif-i"
            style={{ fontSize: 17, color: "var(--ink-2)", marginBottom: 6 }}
          >
            {bucket === "all" ? (
              <>No bookings yet.</>
            ) : (
              <>
                No <em style={{ color: "var(--gold)" }}>{BUCKET_LABEL[bucket].toLowerCase()}</em> bookings yet.
              </>
            )}
          </p>
          <p className="small" style={{ maxWidth: "44ch", margin: "0 auto" }}>
            Bookings land here as you confirm tickets, hotels and hire cars
            against an itinerary. Open any stop and use{" "}
            <span style={{ fontWeight: 600 }}>+ Add booking</span>.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <Section title={`Upcoming · ${upcoming.length}`}>
              {upcoming.map((b) => (
                <BookingCard key={b.id} booking={b} timezone={wsCfg.timezone} />
              ))}
            </Section>
          ) : null}

          {past.length > 0 ? (
            <Section title={`Past · ${past.length}`} muted>
              {past.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  timezone={wsCfg.timezone}
                  past
                />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  muted,
}: {
  title: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div className="flank left" style={{ opacity: muted ? 0.7 : 1 }}>
        <span>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

function isBucket(v?: string): v is Bucket {
  return (
    v === "all" || v === "rail" || v === "flights" || v === "stays" || v === "cars"
  );
}

function bucketForBooking(b: BookingRow): Bucket {
  const p = (b.provider ?? "").toLowerCase();
  if (
    p.includes("hotel") ||
    p.includes("booking.com") ||
    p.includes("airbnb")
  )
    return "stays";
  if (
    p.includes("trainline") ||
    p.includes("rail") ||
    p.includes("avanti") ||
    p.includes("gwr") ||
    p.includes("lner") ||
    p.includes("tfl") ||
    p.includes("tube")
  )
    return "rail";
  if (
    p.includes("airline") ||
    p.includes("ba") ||
    p.includes("klm") ||
    p.includes("flight") ||
    p.includes("ryan") ||
    p.includes("easy")
  )
    return "flights";
  if (
    p.includes("car-hire") ||
    p.includes("hertz") ||
    p.includes("avis") ||
    p.includes("enterprise") ||
    p.includes("sixt")
  )
    return "cars";
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

const STATUS_PILL: Record<string, string> = {
  booked: "pill-sage",
  changed: "pill-amber",
  cancelled: "pill-rust",
  refunded: "pill-rust",
  unknown: "pill-soft",
};

const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  changed: "Changed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  unknown: "Pending",
};

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

  const code = isStay
    ? null
    : `${codeFor(fromName)}→${codeFor(toName)}`;

  const dateStr = booking.departure_at
    ? fmtShortDate(booking.departure_at, timezone)
    : booking.booked_at
      ? fmtShortDate(booking.booked_at, timezone)
      : "—";

  const title = booking.provider
    ? `${capitalise(booking.provider)}${
        booking.segments?.[0]?.train_number
          ? ` · ${booking.segments[0].train_number}`
          : ""
      }`
    : booking.segments?.[0]?.train_number ?? "Booking";

  const sub = booking.departure_at && booking.arrival_at
    ? `${fmtTime(booking.departure_at, timezone)} → ${fmtTime(booking.arrival_at, timezone)}${
        booking.segments?.length > 1
          ? ` · change at ${booking.segments
              .slice(0, -1)
              .map((s) => s.to_location_name)
              .join(", ")}`
          : booking.seat_reservation
            ? ` · ${booking.seat_reservation}`
            : ""
      }`
    : booking.seat_reservation ?? "";

  const statusKey = booking.ticket_status ?? "unknown";

  return (
    <article
      className="card"
      style={{
        padding: 16,
        opacity: past ? 0.78 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              flexWrap: "wrap",
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>
              {dateStr}
            </span>
            {code ? (
              <span className="mono" style={{ fontSize: 11, color: "var(--gold-2)" }}>
                {code}
              </span>
            ) : null}
            {isStay ? (
              <span className="mono" style={{ fontSize: 11, color: "var(--gold-2)" }}>
                {booking.arrival_location?.name ?? fromName}
              </span>
            ) : null}
            {isFlight ? <span className="pill pill-soft">Flight</span> : null}
            {isCar ? <span className="pill pill-soft">Car hire</span> : null}
            {isStay ? <span className="pill pill-soft">Stay</span> : null}
          </div>
          <div
            style={{
              fontFamily: "var(--sans)",
              fontWeight: 600,
              fontSize: 15,
              color: "var(--ink)",
            }}
          >
            {title}
          </div>
          {sub ? (
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-dim)",
                marginTop: 2,
              }}
            >
              {sub}
            </div>
          ) : null}
          {booking.booking_reference ? (
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--ink-faint)",
                marginTop: 6,
              }}
            >
              Ref · {booking.booking_reference}
            </div>
          ) : null}
          {booking.booking_intent?.itinerary ? (
            <Link
              href={`/itineraries/${booking.booking_intent.itinerary.id}`}
              className="mono"
              style={{
                display: "inline-block",
                marginTop: 6,
                fontSize: 10.5,
                color: "var(--gold-2)",
                textDecoration: "none",
              }}
            >
              ↳ {booking.booking_intent.itinerary.title ??
                fmtShortDate(
                  booking.booking_intent.itinerary.date_start,
                  timezone,
                )}
            </Link>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span className={`pill ${STATUS_PILL[statusKey] ?? "pill-soft"}`}>
            <span className="dot" />
            {STATUS_LABEL[statusKey] ?? statusKey}
          </span>
          {booking.actual_price != null ? (
            <span
              style={{
                fontFamily: "var(--display)",
                fontWeight: 500,
                fontSize: 20,
                color: "var(--ink)",
                letterSpacing: "-0.02em",
              }}
            >
              {fmtMoney(Number(booking.actual_price), booking.currency)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function codeFor(name: string): string {
  if (!name || name === "—") return "—";
  // Take first 3 letters of the most significant word.
  const word = name.split(/\s+/)[0];
  return word.slice(0, 3).toUpperCase();
}

function capitalise(s: string): string {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

function fmtMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

function fmtShortDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: tz,
  })
    .format(new Date(iso))
    .replace(",", "");
}

function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}

function Plus() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
