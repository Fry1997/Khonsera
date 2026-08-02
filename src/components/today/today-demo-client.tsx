"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import type { TicketVM } from "@/components/concierge";
import { AppScreen } from "@/components/ui/page-shell";
import { LiveDay } from "@/components/today/live-day";
import { TodaySpine } from "@/components/today/today-spine";
import {
  navModeForTransition,
  type SpineAnchor,
} from "@/components/today/spine-model";

// Interactive rendering for the staff-only demonstration scenario. It is a
// separate data source from the signed-in user's Today: no itinerary rows are
// read, created or changed here. The scenario is rendered through the same
// LiveDay, TodaySpine, pass and navigation components as the real screen, so
// fixes and design changes carry to both without maintaining a second UI.

const HARPENDEN = {
  lat: 51.8176,
  lng: -0.354,
  name: "Home, Harpenden",
};
const LUTON = { lat: 51.8821, lng: -0.4147 };
const WELLINGBOROUGH = { lat: 52.2962, lng: -0.6896 };

const DEPARTURE_MINUTES = 45;
const ARRIVAL_MINUTES = 70;
const REVIEW_MINUTES = 95;

const londonClock = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

export function TodayDemoClient() {
  // The scenario is rebuilt relative to the moment it is opened. It behaves
  // like a live day without ever borrowing the user's actual itinerary data.
  const [base] = useState(() => Date.now());
  const at = useMemo(
    () => (minutes: number) =>
      new Date(base + minutes * 60_000).toISOString(),
    [base],
  );

  const ticket: TicketVM = useMemo(
    () => ({
      id: "demo-luton-run",
      kind: "rail",
      operator: "East Midlands Railway",
      reference: "DEMO 24B",
      source: "forwarded",
      consequence:
        "The Wellingborough arrival leaves a protected walk to the review.",
      legs: [
        {
          id: "demo-luton-leg",
          origin: {
            place: "Luton",
            code: "LUT",
            time: at(DEPARTURE_MINUTES),
            platform: "2",
          },
          destination: {
            place: "Wellingborough",
            code: "WEL",
            time: at(ARRIVAL_MINUTES),
          },
          durationMinutes: 25,
          travelClass: "Standard",
          ticketType: "Off-Peak Day Single",
          coach: "B",
          seat: "24 · table",
          barcodes: [
            {
              format: "aztec",
              value: "KHONSERA-DEMO-NOT-A-VALID-TICKET",
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
        id: "demo-luton",
        type: "transport_arrival",
        title: "Luton Station",
        arriveByIso: at(DEPARTURE_MINUTES),
        endIso: at(DEPARTURE_MINUTES),
        coord: LUTON,
        plannedTravelMinutes: 16,
        bufferMinutes: 8,
        navMode: navModeForTransition("walk"),
        station: {
          name: "Luton",
          code: "LUT",
          kind: "rail_station",
        },
        role: "departure",
        pass: {
          ticket,
          crs: "LUT",
          time: londonClock(at(DEPARTURE_MINUTES)),
          dest: "WEL",
        },
      },
      {
        id: "demo-wellingborough",
        type: "transport_arrival",
        title: "Wellingborough Station",
        arriveByIso: at(ARRIVAL_MINUTES),
        endIso: at(ARRIVAL_MINUTES),
        coord: WELLINGBOROUGH,
        plannedTravelMinutes: 25,
        navMode: navModeForTransition("walk"),
        station: {
          name: "Wellingborough",
          code: "WEL",
          kind: "rail_station",
        },
        role: "arrival",
      },
      {
        id: "demo-review",
        type: "appointment",
        title: "Project review",
        place: "Wellingborough",
        arriveByIso: at(REVIEW_MINUTES),
        endIso: at(REVIEW_MINUTES + 60),
        coord: WELLINGBOROUGH,
        plannedTravelMinutes: 8,
        bufferMinutes: 10,
        navMode: navModeForTransition("walk"),
        station: null,
        role: "stop",
      },
    ],
    [at, ticket],
  );

  return (
    <AppScreen
      eyebrow="Staff demo"
      title="Project review"
      description="Harpenden → Luton → Wellingborough"
      headerClassName="cc-today-head"
      className="cc-today-direction cc-today-demo"
      data-demo="true"
    >
      <div className="cc-demo-banner" role="status">
        <span className="cc-demo-banner-mark">Demo scenario</span>
        <span className="cc-demo-banner-copy">
          This is isolated sample data, not your Today. It uses the production
          Today components and live routing services, but cannot change your plan.
        </span>
        <Link href={"/settings" as Route} className="cc-demo-banner-link">
          Demo settings
        </Link>
      </div>

      <div className="cc-day-dashboard">
        <section className="cc-today-command" aria-label="Demo next move">
          <div className="cc-today-command-content">
            <LiveDay
              anchors={anchors}
              sub="Demo scenario · from Harpenden"
              base={HARPENDEN}
            />
          </div>
        </section>

        <div className="cc-day-forecast" aria-label="Demo scenario status">
          <div className="cc-demo-readout">
            <span className="cc-demo-readout-label">Scenario clock</span>
            <strong>{londonClock(new Date().toISOString())}</strong>
            <span>Opened with all services on time</span>
          </div>
        </div>

        <section
          className="cc-day-primary"
          aria-label="Demo itinerary for project review"
        >
          <TodaySpine anchors={anchors} nextId="demo-luton" />
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
