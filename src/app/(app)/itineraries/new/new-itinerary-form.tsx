"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FormError } from "@/components/ui/form";
import { createItineraryFromBrief } from "@/lib/actions/itineraries";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";

const PURPOSE_OPTIONS: Array<{
  value: "visit" | "conference" | "internal" | "personal" | "other";
  label: string;
  durationLabel: string;
  durationMins: number;
}> = [
  { value: "visit", label: "Client visit", durationLabel: "~1h 30m", durationMins: 90 },
  { value: "conference", label: "Conference", durationLabel: "Full day", durationMins: 8 * 60 },
  { value: "internal", label: "Internal", durationLabel: "1h", durationMins: 60 },
  { value: "personal", label: "Personal", durationLabel: "Open", durationMins: 4 * 60 },
];

const TIME_PRESETS = ["09:00", "10:00", "13:00", "18:00", "19:30"];

export function NewItineraryBrief({
  customers,
  customerSites,
  locations,
  timezone,
}: {
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  timezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  // Anchor — what / where / when.
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [date, setDate] = useState<string>(defaultAnchorDate());
  const [time, setTime] = useState<string>("09:00");
  const [purpose, setPurpose] =
    useState<(typeof PURPOSE_OPTIONS)[number]["value"]>("visit");
  const [duration, setDuration] = useState<number>(90);

  // Title override — optional. If left blank we auto-derive on submit.
  const [titleOverride, setTitleOverride] = useState<string>("");

  // Hotel — optional context. Toggled in/out.
  const [hotelOn, setHotelOn] = useState(false);
  const [hotel, setHotel] = useState<PlaceSelection | null>(null);
  const [hotelCheckIn, setHotelCheckIn] = useState<string>("");
  const [hotelCheckInTime, setHotelCheckInTime] = useState<string>("15:00");
  const [hotelCheckOut, setHotelCheckOut] = useState<string>("");

  // Notes — optional.
  const [notesOn, setNotesOn] = useState(false);
  const [notes, setNotes] = useState<string>("");

  const datePresets = useMemo(() => buildDatePresets(timezone), [timezone]);

  // Sync hotel check-in to one day before anchor when toggled on.
  const handleHotelOn = () => {
    setHotelOn(true);
    if (!hotelCheckIn) {
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      setHotelCheckIn(d.toISOString().slice(0, 10));
    }
    if (!hotelCheckOut) {
      setHotelCheckOut(date);
    }
  };

  const canSubmit = place != null && date.length > 0 && time.length > 0;

  const submit = () => {
    setFeedback(null);

    if (!place) {
      setFeedback({
        message: "Pick the place you need to be — the anchor of the day.",
        fieldErrors: { anchor_location_id: "required" },
      });
      return;
    }

    startTransition(async () => {
      const anchor =
        place.kind === "location"
          ? { anchor_location_id: place.location_id }
          : place.kind === "customer_site"
            ? {
                anchor_customer_site_id: place.customer_site_id,
                anchor_customer_id: place.customer_id,
                anchor_label: place.label,
              }
            : { anchor_customer_id: place.customer_id, anchor_label: place.label };

      const hotelArgs =
        hotelOn && hotel
          ? {
              ...(hotel.kind === "location"
                ? { hotel_location_id: hotel.location_id }
                : { hotel_label: hotel.label }),
              hotel_check_in_date: hotelCheckIn || null,
              hotel_check_in_time: hotelCheckInTime || null,
              hotel_check_out_date: hotelCheckOut || null,
            }
          : {};

      const result = await createItineraryFromBrief({
        ...anchor,
        ...hotelArgs,
        anchor_date: date,
        anchor_time: time,
        duration_minutes: duration,
        purpose,
        title: titleOverride.trim() || null,
        notes: notesOn ? notes.trim() || null : null,
        timezone,
      });

      if (!result.ok) {
        setFeedback(feedbackFromError(result.error));
        return;
      }
      router.push(`/itineraries/${result.value.id}`);
      router.refresh();
    });
  };

  return (
    <div className="brief-grid">
      {/* Left — the form itself */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <FormError message={feedback?.message} />

        {/* ANCHOR */}
        <section className="brief-card brief-card-hero">
          <BriefHeading n="1" label="The anchor">
            Where do you need to be?
          </BriefHeading>
          <p className="brief-helper">
            A station, a customer site, an office, a hotel — anywhere. Search
            it from saved places, your customers, or directly from Google.
          </p>
          <PlacePicker
            customers={customers}
            customerSites={customerSites}
            locations={locations}
            value={place}
            onChange={setPlace}
            placeholder="Search a place, customer, or anywhere on Google…"
          />
        </section>

        {/* WHEN */}
        <section className="brief-card">
          <BriefHeading n="2" label="The day & time">
            When do you need to be there?
          </BriefHeading>

          <div className="brief-when-row">
            <label className="brief-field">
              <span className="uc">Date</span>
              <input
                type="date"
                className="field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="brief-field">
              <span className="uc">Arrive by</span>
              <input
                type="time"
                className="field"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>

          <div className="brief-pill-row">
            {datePresets.map((p) => (
              <button
                key={p.value}
                type="button"
                className="pill brief-pill"
                data-active={p.value === date}
                onClick={() => setDate(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="brief-pill-row" style={{ marginTop: 6 }}>
            {TIME_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                className="pill brief-pill"
                data-active={t === time}
                onClick={() => setTime(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* PURPOSE */}
        <section className="brief-card">
          <BriefHeading n="3" label="The why" optional>
            What for?
          </BriefHeading>
          <p className="brief-helper">
            Sets a sensible duration so the rest of the day frames around it.
            Change it any time in the editor.
          </p>
          <div className="brief-pill-row" style={{ marginTop: 8 }}>
            {PURPOSE_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="pill brief-pill brief-pill-lg"
                data-active={p.value === purpose}
                onClick={() => {
                  setPurpose(p.value);
                  setDuration(p.durationMins);
                }}
              >
                <span>{p.label}</span>
                <span className="brief-pill-sub">{p.durationLabel}</span>
              </button>
            ))}
          </div>
        </section>

        {/* OPTIONAL CONTEXT */}
        <section className="brief-card brief-card-soft">
          <BriefHeading n="✦" label="Context" optional>
            Anything either side of the anchor?
          </BriefHeading>
          <p className="brief-helper">
            Hotels, dinners and extra stops can be added in the editor too —
            but wiring a hotel in here lets Khonsera plan from the right
            doorstep.
          </p>

          <div className="brief-context-row">
            {!hotelOn ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleHotelOn}
              >
                + Hotel before
              </button>
            ) : null}
            {!notesOn ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setNotesOn(true)}
              >
                + Notes
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled
              title="Dinners, additional stops and extra context are added in the editor."
            >
              + More in the editor →
            </button>
          </div>

          {hotelOn ? (
            <div className="brief-subcard" style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span className="uc">Hotel</span>
                <button
                  type="button"
                  onClick={() => setHotelOn(false)}
                  style={{
                    fontSize: 11.5,
                    color: "var(--rust)",
                  }}
                >
                  Remove
                </button>
              </div>
              <PlacePicker
                customers={[]}
                customerSites={[]}
                locations={locations.filter(
                  (l) => l.type === "hotel" || l.type === "other",
                )}
                showCustomers={false}
                googleTypes="lodging"
                defaultNewType="hotel"
                value={hotel}
                onChange={setHotel}
                placeholder="Hotel name or search anywhere…"
              />
              <div className="brief-when-row" style={{ marginTop: 10 }}>
                <label className="brief-field">
                  <span className="uc">Check-in</span>
                  <input
                    type="date"
                    className="field"
                    value={hotelCheckIn}
                    onChange={(e) => setHotelCheckIn(e.target.value)}
                  />
                </label>
                <label className="brief-field">
                  <span className="uc">From</span>
                  <input
                    type="time"
                    className="field"
                    value={hotelCheckInTime}
                    onChange={(e) => setHotelCheckInTime(e.target.value)}
                  />
                </label>
                <label className="brief-field">
                  <span className="uc">Check-out</span>
                  <input
                    type="date"
                    className="field"
                    value={hotelCheckOut}
                    onChange={(e) => setHotelCheckOut(e.target.value)}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {notesOn ? (
            <div className="brief-subcard" style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span className="uc">Notes</span>
                <button
                  type="button"
                  onClick={() => setNotesOn(false)}
                  style={{
                    fontSize: 11.5,
                    color: "var(--rust)",
                  }}
                >
                  Remove
                </button>
              </div>
              <textarea
                className="field"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="The brief, dress code, who's expected, anything Khonsera should know."
              />
            </div>
          ) : null}
        </section>

        {/* TITLE OVERRIDE (subtle) */}
        <details className="brief-details">
          <summary className="brief-details-summary">
            <span className="uc">Title override</span>
            <span className="brief-details-hint">
              {titleOverride
                ? `“${titleOverride}”`
                : "Khonsera will pick one for you"}
            </span>
          </summary>
          <input
            type="text"
            className="field"
            value={titleOverride}
            onChange={(e) => setTitleOverride(e.target.value)}
            placeholder="e.g. Belper site visit"
            style={{ marginTop: 8 }}
          />
        </details>

        {/* SUBMIT */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            disabled={!canSubmit || pending}
            onClick={submit}
            className="btn btn-gold btn-lg"
          >
            {pending ? "Building your day…" : "Build my day"}
            <Arrow />
          </button>
          {!canSubmit ? (
            <span className="brief-helper" style={{ margin: 0 }}>
              Pick a place and a time to continue.
            </span>
          ) : null}
        </div>
      </div>

      {/* Right — live preview of the bones */}
      <aside className="brief-preview" aria-label="What Khonsera will build">
        <div className="flank left">
          <span>What we&rsquo;ll build</span>
        </div>
        <BonesPreview
          place={place}
          date={date}
          time={time}
          duration={duration}
          purpose={purpose}
          hotelOn={hotelOn}
          hotel={hotel}
          hotelCheckIn={hotelCheckIn}
          hotelCheckOut={hotelCheckOut}
          titleOverride={titleOverride}
        />
      </aside>
    </div>
  );
}

function BriefHeading({
  n,
  label,
  optional,
  children,
}: {
  n: string;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <header style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span className="brief-step">{n}</span>
        <span className="uc">
          {label}
          {optional ? " · optional" : ""}
        </span>
      </div>
      <h2
        style={{
          fontFamily: "var(--display)",
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 22,
          color: "var(--ink)",
          margin: "6px 0 0",
          letterSpacing: "-0.015em",
        }}
      >
        {children}
      </h2>
    </header>
  );
}

function BonesPreview({
  place,
  date,
  time,
  duration,
  purpose,
  hotelOn,
  hotel,
  hotelCheckIn,
  hotelCheckOut,
  titleOverride,
}: {
  place: PlaceSelection | null;
  date: string;
  time: string;
  duration: number;
  purpose: string;
  hotelOn: boolean;
  hotel: PlaceSelection | null;
  hotelCheckIn: string;
  hotelCheckOut: string;
  titleOverride: string;
}) {
  if (!place) {
    return (
      <div className="brief-preview-empty">
        <p
          className="serif-i"
          style={{ color: "var(--ink-dim)", margin: 0, lineHeight: 1.5 }}
        >
          Pick the anchor and Khonsera will sketch the spine of the day here —
          home, the hotel if you&rsquo;re staying over, and the appointment
          itself.
        </p>
      </div>
    );
  }

  const stops: Array<{
    time: string;
    title: string;
    sub: string;
    kind: "home" | "hotel" | "anchor";
  }> = [];

  stops.push({
    time: "—",
    title: "Home",
    sub: "Set in your travel profile",
    kind: "home",
  });

  if (hotelOn && hotel) {
    stops.push({
      time: hotelCheckIn ? fmtShortDate(hotelCheckIn) : "TBC",
      title: hotel.label,
      sub: hotelCheckOut
        ? `Check-in${hotelCheckIn ? ` ${fmtShortDate(hotelCheckIn)}` : ""} → ${fmtShortDate(hotelCheckOut)}`
        : "Hotel",
      kind: "hotel",
    });
  }

  stops.push({
    time: `${time}`,
    title: place.label,
    sub: `${fmtFullDate(date)} · ${fmtDur(duration)} · ${purposeLabel(purpose)}`,
    kind: "anchor",
  });

  return (
    <div
      className="card brief-preview-card"
      style={{ padding: 18, marginTop: 10 }}
    >
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span className="uc">Working title</span>
        <span
          className="display-i"
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "var(--ink)",
            lineHeight: 1.15,
          }}
        >
          {titleOverride || place.label}
        </span>
      </div>
      <div className="tl">
        {stops.map((s, i) => (
          <BonesStop
            key={i}
            s={s}
            isLast={i === stops.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function BonesStop({
  s,
  isLast,
}: {
  s: { time: string; title: string; sub: string; kind: "home" | "hotel" | "anchor" };
  isLast: boolean;
}) {
  return (
    <>
      <div className="tl-time">{s.time}</div>
      <div className="tl-rail">
        <div className={s.kind === "anchor" ? "tl-dot gold" : "tl-dot"} />
      </div>
      <div
        className="tl-content"
        style={{
          padding: "6px 0 14px",
          opacity: isLast ? 1 : 0.92,
        }}
      >
        <p className="tl-eyebrow" style={{ marginBottom: 2 }}>
          {s.kind === "home" ? "Start" : s.kind === "hotel" ? "Stay" : "Appointment"}
        </p>
        <h3 className="tl-title">
          {s.kind === "anchor" ? <em>{s.title}</em> : s.title}
        </h3>
        <p className="tl-sub">{s.sub}</p>
      </div>
    </>
  );
}

function Arrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function defaultAnchorDate(): string {
  // Tomorrow if it's before 7pm, else two days out.
  const now = new Date();
  const target = new Date(now);
  if (now.getHours() >= 19) {
    target.setDate(target.getDate() + 2);
  } else {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString().slice(0, 10);
}

function buildDatePresets(timezone: string) {
  const now = new Date();
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      timeZone: timezone,
    }).format(d);
  const value = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(d);

  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(today.getDate() + 1);
  const out: Array<{ label: string; value: string }> = [
    { label: "Today", value: value(today) },
    { label: "Tomorrow", value: value(tomorrow) },
  ];
  for (let i = 2; i <= 5; i++) {
    const d = new Date(now);
    d.setDate(today.getDate() + i);
    out.push({ label: fmt(d), value: value(d) });
  }
  return out;
}

function fmtShortDate(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${iso}T12:00:00Z`));
}

function fmtFullDate(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${iso}T12:00:00Z`));
}

function fmtDur(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function purposeLabel(p: string): string {
  switch (p) {
    case "conference":
      return "Conference";
    case "internal":
      return "Internal";
    case "personal":
      return "Personal";
    case "other":
      return "Other";
    default:
      return "Visit";
  }
}
