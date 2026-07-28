import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, CloudSun, Ticket, WalletCards } from "lucide-react";
import { MobileAppbar } from "@/components/shell/mobile-appbar";
import { LiveDay } from "@/components/today/live-day";
import { TodaySpine } from "@/components/today/today-spine";
import { TodayBufferControl } from "@/components/today/today-buffer-control";
import { AppScreen } from "@/components/ui/page-shell";
import type { SpineAnchor } from "@/components/today/spine-model";
import type { TicketVM } from "@/components/concierge";
import type { NavigationIcon } from "@/lib/navigation";
import { navigationGlyphs } from "@/lib/navigation";

function at(now: number, minutes: number): string {
  return new Date(now + minutes * 60_000).toISOString();
}

function Glyph({ name }: { name: NavigationIcon }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={navigationGlyphs[name]} />
    </svg>
  );
}

function PreviewTabbar() {
  const tabs: Array<{
    label: string;
    icon: NavigationIcon;
    active?: boolean;
  }> = [
    { label: "Today", icon: "today", active: true },
    { label: "Plan", icon: "plan" },
    { label: "Tasks", icon: "tasks" },
    { label: "Wallet", icon: "wallet" },
    { label: "Navigate", icon: "navigate" },
  ];

  return (
    <nav className="cc-tabbar" aria-label="Primary preview">
      {tabs.map((tab) => (
        <span
          key={tab.label}
          className="cc-tab"
          data-active={tab.active ? "true" : "false"}
        >
          <span className="cc-tab-ico" aria-hidden>
            <Glyph name={tab.icon} />
          </span>
          <span className="cc-tab-label">{tab.label}</span>
          <span className="cc-tab-dot" />
        </span>
      ))}
    </nav>
  );
}

export default function TodayDesignPreview() {
  if (process.env.VERCEL_ENV === "production") notFound();

  const now = Date.now();
  const ticket: TicketVM = {
    id: "screen-one-preview-ticket",
    kind: "rail",
    operator: "Thameslink",
    source: "manual",
    legs: [
      {
        id: "screen-one-preview-leg",
        origin: {
          place: "Harpenden",
          code: "HPD",
          time: at(now, 75),
          platform: "1",
        },
        destination: {
          place: "London St Pancras",
          code: "STP",
          time: at(now, 108),
        },
        durationMinutes: 33,
        status: { status: "on_time" },
      },
    ],
  };
  const anchors: SpineAnchor[] = [
    {
      id: "screen-one-preview-station",
      type: "custom",
      title: "Harpenden Station",
      place: "Harpenden",
      arriveByIso: at(now, 60),
      endIso: at(now, 75),
      coord: { lat: 51.8146, lng: -0.3515 },
      plannedTravelMinutes: 12,
      bufferMinutes: 15,
      navMode: "walk",
      station: {
        name: "Harpenden",
        code: "HPD",
        kind: "rail_station",
      },
      role: "departure",
      pass: {
        ticket,
        crs: "HPD",
        time: null,
        dest: "STP",
      },
    },
    {
      id: "screen-one-preview-change",
      type: "custom",
      title: "London St Pancras",
      place: "London",
      arriveByIso: at(now, 108),
      endIso: at(now, 118),
      coord: { lat: 51.5308, lng: -0.1238 },
      plannedTravelMinutes: null,
      navMode: "walk",
      station: {
        name: "London St Pancras",
        code: "STP",
        kind: "rail_station",
      },
      role: "changeover",
    },
    {
      id: "screen-one-preview-dinner",
      type: "reservation",
      title: "Dinner at Sessions Arts Club",
      place: "Clerkenwell",
      arriveByIso: at(now, 150),
      endIso: at(now, 255),
      coord: { lat: 51.5229, lng: -0.111 },
      plannedTravelMinutes: 18,
      navMode: "walk",
      station: null,
      role: "stop",
    },
  ];

  return (
    <div className="khonsera-app khonsera-app--unified">
      <MobileAppbar
        email="preview@khonsera.com"
        firstName="Preview"
        initials="KP"
        isStaff={false}
        mode="work"
      />
      <main className="cc-app-main">
        <AppScreen
          eyebrow="MON, 28 JUL"
          title="Work"
          description={
            <span className="cc-today-destination">
              From <strong>20 Wilce Avenue</strong>
            </span>
          }
          titleAs="h1"
          headerClassName="cc-today-head"
          className="cc-today-direction"
          actions={
            <div className="cc-weather" data-day="true">
              <CloudSun className="cc-weather-glyph" aria-hidden />
              <span className="cc-weather-temp">18&deg;</span>
              <span className="cc-weather-meta">
                <span className="cc-weather-headline">Partly cloudy</span>
                <span className="cc-weather-place">13&deg; / Harpenden</span>
              </span>
            </div>
          }
        >
          <div className="cc-day-dashboard">
            <section className="cc-today-command" aria-label="Your next move">
              <div className="cc-today-command-content">
                <LiveDay
                  anchors={anchors}
                  sub="Work · Harpenden to London"
                  base={null}
                />
              </div>
            </section>

            <div className="cc-day-forecast" aria-label="Day conditions">
              <div
                className="cc-weather-hours"
                aria-label="Today's forecast by the hour"
              >
                {[
                  ["Now", "18°"],
                  ["18:00", "17°"],
                  ["19:00", "16°"],
                  ["20:00", "15°"],
                  ["21:00", "14°"],
                  ["22:00", "13°"],
                ].map(([label, temperature]) => (
                  <div className="cc-weather-hour" key={label}>
                    <span className="cc-weather-hour-time">{label}</span>
                    <span className="cc-weather-hour-temp">{temperature}</span>
                    <CloudSun className="cc-weather-hour-glyph" aria-hidden />
                  </div>
                ))}
              </div>
            </div>

            <section
              className="cc-day-primary"
              aria-label="Live preview itinerary"
            >
              <TodaySpine
                anchors={anchors}
                nextId={anchors[0]?.id}
                nowOverride={now}
                resolveEndContext={false}
                toolbar={<TodayBufferControl initialMinutes={15} />}
              />
            </section>

            <aside
              className="cc-day-context"
              aria-label="Day tools and documents"
            >
              <Link
                href="/wallet"
                className="cc-today-context-row cc-today-context-row--ticket"
              >
                <span className="cc-today-context-icon">
                  <Ticket aria-hidden />
                </span>
                <span className="cc-today-context-copy">
                  <strong>Tickets today</strong>
                  <span>You have 1 active ticket</span>
                </span>
                <span className="cc-today-context-chevron">
                  <ChevronRight aria-hidden />
                </span>
              </Link>
              <Link
                href="/wallet"
                className="cc-today-context-row cc-today-context-row--wallet"
              >
                <span className="cc-today-context-icon">
                  <WalletCards aria-hidden />
                </span>
                <span className="cc-today-context-copy">
                  <strong>Wallet</strong>
                </span>
                <span className="cc-today-context-chevron">
                  <ChevronRight aria-hidden />
                </span>
              </Link>
              <div className="cc-today-plan-action">
                <button type="button" className="cc-btn cc-btn-gold">
                  <span aria-hidden>+</span> Plan something
                </button>
              </div>
            </aside>
          </div>
        </AppScreen>
      </main>
      <div className="cc-tabbar-wrap">
        <PreviewTabbar />
      </div>
    </div>
  );
}
