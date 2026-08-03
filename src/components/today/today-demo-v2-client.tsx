"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import type { TicketVM } from "@/components/concierge";
import type { LocalWeather } from "@/lib/actions/weather";
import { AppScreen } from "@/components/ui/page-shell";
import { LiveDay } from "@/components/today/live-day";
import { TodaySpine } from "@/components/today/today-spine";
import {
  navModeForTransition,
  type SpineAnchor,
} from "@/components/today/spine-model";

const HOME = {
  lat: 52.2962,
  lng: -0.6896,
  name: "Home, Wellingborough",
};
const WELLINGBOROUGH = { lat: 52.3038, lng: -0.6767 };
const LUTON = { lat: 51.8821, lng: -0.4147 };
const HARPENDEN = { lat: 51.8147, lng: -0.3516 };
const REVIEW = { lat: 51.8162, lng: -0.3572 };

const WEL_ARRIVAL_MINUTES = 37;
const WEL_DEPARTURE_MINUTES = 45;
const LUT_ARRIVAL_MINUTES = 68;
const LUT_DEPARTURE_MINUTES = 74;
const HPD_ARRIVAL_MINUTES = 85;
const REVIEW_MINUTES = 98;

const londonClock = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

function DemoWeatherGlyph({ isDay }: { isDay: boolean }) {
  return isDay ? (
    <svg
      className="cc-weather-glyph"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="24" cy="24" r="7" />
      <path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M38.1 9.9l-4.2 4.2M14.1 33.9l-4.2 4.2" />
    </svg>
  ) : (
    <svg
      className="cc-weather-glyph"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M37 31.5A16 16 0 0 1 16.5 11 16 16 0 1 0 37 31.5Z" />
    </svg>
  );
}

export function TodayDemoV2Client({
  weather,
  buildId,
}: {
  weather: LocalWeather | null;
  buildId: string;
}) {
  const [base] = useState(() => Date.now());
  const at = useMemo(
    () => (minutes: number) =>
      new Date(base + minutes * 60_000).toISOString(),
    [base],
  );

  const firstTicket: TicketVM = useMemo(
    () => ({
      id: "demo-wellingborough-luton-v2",
      kind: "rail",
      operator: "East Midlands Railway",
      reference: "DEMO WEL-01",
      source: "forwarded",
      consequence:
        "Your arrival at Luton leaves a protected six-minute change.",
      legs: [
        {
          id: "demo-wellingborough-luton-leg-v2",
          origin: {
            place: "Wellingborough",
            code: "WEL",
            time: at(WEL_DEPARTURE_MINUTES),
            platform: "2",
          },
          destination: {
            place: "Luton",
            code: "LUT",
            time: at(LUT_ARRIVAL_MINUTES),
          },
          durationMinutes: 23,
          travelClass: "Standard",
          ticketType: "Off-Peak Day Single",
          coach: "B",
          seat: "42 · table",
          barcodes: [
            {
              format: "aztec",
              value: "KHONSERA-DEMO-WEL-LUT-V2-NOT-A-VALID-TICKET",
              passengerLabel: "Demo passenger",
            },
          ],
          status: { status: "on_time", label: "On time" },
        },
      ],
    }),
    [at],
  );

  const secondTicket: TicketVM = useMemo(
    () => ({
      id: "demo-luton-harpenden-v2",
      kind: "rail",
      operator: "Thameslink",
      reference: "DEMO LUT-02",
      source: "forwarded",
      consequence:
        "Harpenden station leaves a short, comfortable walk to the review.",
      legs: [
        {
          id: "demo-luton-harpenden-leg-v2",
          origin: {
            place: "Luton",
            code: "LUT",
            time: at(LUT_DEPARTURE_MINUTES),
            platform: "4",
          },
          destination: {
            place: "Harpenden",
            code: "HPD",
            time: at(HPD_ARRIVAL_MINUTES),
          },
          durationMinutes: 11,
          travelClass: "Standard",
          ticketType: "Anytime Day Single",
          barcodes: [
            {
              format: "aztec",
              value: "KHONSERA-DEMO-LUT-HPD-V2-NOT-A-VALID-TICKET",
              passengerLabel: "Demo passenger",
            },
          ],
          status: { status: "on_time", label: "On time" },
        },
      ],
    }),
    [at],
  );

  const anchors: SpineAnchor[] = useMemo(
    () => [
      {
        id: "demo-wellingborough-arrival-v2",
        type: "transport_arrival",
        title: "Arrive at Wellingborough Station",
        arriveByIso: at(WEL_ARRIVAL_MINUTES),
        endIso: at(WEL_DEPARTURE_MINUTES),
        coord: WELLINGBOROUGH,
        plannedTravelMinutes: 16,
        bufferMinutes: 0,
        navMode: navModeForTransition("walk"),
        station: {
          name: "Wellingborough",
          code: "WEL",
          kind: "rail_station",
        },
        role: "stop",
      },
      {
        id: "demo-wellingborough-departure-v2",
        type: "transport_arrival",
        title: "Wellingborough Station",
        arriveByIso: at(WEL_DEPARTURE_MINUTES),
        endIso: at(WEL_DEPARTURE_MINUTES),
        coord: WELLINGBOROUGH,
        plannedTravelMinutes: null,
        navMode: navModeForTransition("walk"),
        station: {
          name: "Wellingborough",
          code: "WEL",
          kind: "rail_station",
        },
        role: "departure",
        pass: {
          ticket: firstTicket,
          crs: "WEL",
          time: londonClock(at(WEL_DEPARTURE_MINUTES)),
          dest: "LUT",
        },
      },
      {
        id: "demo-luton-change-v2",
        type: "transport_arrival",
        title: "Luton Station",
        arriveByIso: at(LUT_ARRIVAL_MINUTES),
        endIso: at(LUT_DEPARTURE_MINUTES),
        coord: LUTON,
        plannedTravelMinutes: null,
        navMode: navModeForTransition("walk"),
        station: {
          name: "Luton",
          code: "LUT",
          kind: "rail_station",
        },
        role: "changeover",
        pass: {
          ticket: secondTicket,
          crs: "LUT",
          time: londonClock(at(LUT_DEPARTURE_MINUTES)),
          dest: "HPD",
        },
      },
      {
        id: "demo-harpenden-arrival-v2",
        type: "transport_arrival",
        title: "Harpenden Station",
        arriveByIso: at(HPD_ARRIVAL_MINUTES),
        endIso: at(HPD_ARRIVAL_MINUTES),
        coord: HARPENDEN,
        plannedTravelMinutes: null,
        navMode: navModeForTransition("walk"),
        station: {
          name: "Harpenden",
          code: "HPD",
          kind: "rail_station",
        },
        role: "arrival",
      },
      {
        id: "demo-review-v2",
        type: "appointment",
        title: "Project review",
        place: "The Brew, Harpenden",
        arriveByIso: at(REVIEW_MINUTES),
        endIso: at(REVIEW_MINUTES + 60),
        coord: REVIEW,
        plannedTravelMinutes: 6,
        bufferMinutes: 7,
        navMode: navModeForTransition("walk"),
        station: null,
        role: "stop",
      },
    ],
    [at, firstTicket, secondTicket],
  );

  return (
    <AppScreen
      eyebrow="Today"
      title="Right now"
      titleAs="h1"
      headerClassName="cc-today-head"
      className="cc-today-direction cc-today-demo"
      data-demo="true"
      actions={
        weather ? (
          <div
            className="cc-weather"
            data-day={weather.isDay ? "true" : "false"}
          >
            <DemoWeatherGlyph isDay={weather.isDay} />
            <span className="cc-weather-temp">{weather.tempC}&deg;</span>
            <span className="cc-weather-meta">
              <span className="cc-weather-headline">{weather.headline}</span>
              <span className="cc-weather-place">{weather.place}</span>
            </span>
          </div>
        ) : undefined
      }
    >
      <div className="cc-demo-banner" role="status">
        <span className="cc-demo-banner-mark">Demo scenario</span>
        <span className="cc-demo-banner-copy">
          Sample itinerary only. Your real Today and account data remain untouched.
        </span>
        <Link href={"/settings" as Route} className="cc-demo-banner-link">
          Demo settings
        </Link>
        <span
          aria-label={`Demo build ${buildId}`}
          style={{
            gridColumn: "1 / -1",
            color: "var(--kh-ink-faint)",
            fontFamily: "var(--mono)",
            fontSize: "7px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Build {buildId} · explicit hub stage
        </span>
      </div>

      <div className="cc-day-dashboard">
        <div className="cc-demo-controls" aria-label="Demo scenario clock">
          <div className="cc-demo-readout">
            <span className="cc-demo-readout-label">Scenario clock</span>
            <strong>{londonClock(new Date().toISOString())}</strong>
            <span>Sample journey starts from Wellingborough</span>
          </div>
        </div>

        <section className="cc-today-command" aria-label="Demo next move">
          <div className="cc-today-command-content">
            <LiveDay
              anchors={anchors}
              sub="Demo journey · from Wellingborough"
              base={HOME}
            />
          </div>
        </section>

        <section
          className="cc-day-primary"
          aria-label="Demo itinerary for project review"
        >
          <TodaySpine
            anchors={anchors}
            nextId="demo-wellingborough-arrival-v2"
          />
        </section>

        <aside className="cc-day-context" aria-label="About this demo">
          <div className="cc-context-actions">
            <span className="cc-context-label">Data boundary</span>
            <span className="cc-context-detail">
              Fixed staff scenario. No stops, bookings or status are read from or
              written to your account.
            </span>
          </div>
          <div className="cc-context-actions">
            <span className="cc-context-label">Shared implementation</span>
            <span className="cc-context-detail">
              LiveDay, TodaySpine, tickets, routing and the app-wide design system
              are the same components used by your real Today screen.
            </span>
          </div>
          <Link href={"/settings" as Route} className="cc-btn cc-btn-ghost">
            Turn demo off in Settings
          </Link>
        </aside>
      </div>
    </AppScreen>
  );
}
