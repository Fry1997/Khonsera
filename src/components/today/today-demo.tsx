import Link from "next/link";
import type { Route } from "next";
import { ActiveTile, Pass } from "@/components/concierge";
import type { AnchorVM, BoardingVM, TicketVM } from "@/components/concierge";
import { TodaySpine } from "@/components/today/today-spine";
import { navModeForTransition, type SpineAnchor } from "@/components/today/spine-model";

// Staff-only day-of PREVIEW (/today?demo=1). The real Today projects the DB and
// is empty without a live plan, so this renders the same day-of components
// against a representative fixture — a way to look at and critique the boarding
// callout, the reeling spine, and (as they land) calling points + changeover,
// without needing a real journey. Times are relative to now so it always reads
// as a live afternoon. NEVER on the product path — gated by isStaff + ?demo=1.

function at(minFromNow: number): string {
  return new Date(Date.now() + minFromNow * 60_000).toISOString();
}

const LUTON = { lat: 51.8821, lng: -0.4147 };
const WELLINGBOROUGH = { lat: 52.2962, lng: -0.6896 };

export function TodayDemo() {
  // The surfaced rail leg: Luton → Wellingborough on the Corby train, boarding
  // soon, platform known, with an earlier service sharing the platform.
  const ticket: TicketVM = {
    id: "demo-luton",
    kind: "rail",
    operator: "East Midlands Railway",
    reference: "AB12CD34",
    source: "forwarded",
    consequence: "Off the 16:42 and you reach the review with fifteen minutes in hand.",
    legs: [
      {
        id: "demo-luton-leg",
        origin: { place: "Luton", code: "LUT", time: at(25), platform: "2" },
        destination: { place: "Wellingborough", code: "WEL", time: at(50) },
        durationMinutes: 25,
        travelClass: "Standard",
        ticketType: "Off-Peak Day Single",
        coach: "B",
        seat: "24 (table)",
        barcodes: [{ format: "aztec", value: "RSP-DEMO-AZTEC-PAYLOAD", passengerLabel: "Adult 1" }],
        status: { status: "on_time" },
      },
    ],
  };

  const boarding: BoardingVM = {
    platform: "2",
    toward: "Corby",
    earlier: "Platform 2 also has the 16:58 to Bedford before yours — let that one go.",
  };

  const nextAnchor: AnchorVM = {
    id: "demo-luton",
    type: "transport_arrival",
    title: "Luton Station",
    time: { from: at(25) },
    fixed: true,
  };

  const walk = navModeForTransition("walk");
  const spineAnchors: SpineAnchor[] = [
    {
      id: "demo-home",
      type: "custom",
      title: "Home",
      place: "Harpenden",
      arriveByIso: at(-130),
      endIso: at(-125),
      coord: null,
      plannedTravelMinutes: null,
      navMode: walk,
      station: null,
      role: "stop",
    },
    {
      id: "demo-coffee",
      type: "appointment",
      title: "Coffee with Sam",
      place: "St Albans",
      arriveByIso: at(-95),
      endIso: at(-75),
      coord: null,
      plannedTravelMinutes: null,
      navMode: walk,
      station: null,
      role: "stop",
    },
    {
      id: "demo-luton",
      type: "transport_arrival",
      title: "Luton Station",
      arriveByIso: at(25),
      endIso: at(25),
      coord: LUTON,
      plannedTravelMinutes: 12,
      navMode: walk,
      station: { name: "Luton", code: "LUT", kind: "rail_station" },
      role: "departure",
    },
    {
      id: "demo-welly",
      type: "transport_arrival",
      title: "Wellingborough Station",
      arriveByIso: at(50),
      endIso: at(50),
      coord: WELLINGBOROUGH,
      plannedTravelMinutes: 25,
      navMode: walk,
      station: { name: "Wellingborough", code: "WEL", kind: "rail_station" },
      role: "arrival",
    },
    {
      id: "demo-review",
      type: "appointment",
      title: "Project review",
      place: "Wellingborough",
      arriveByIso: at(75),
      endIso: at(135),
      coord: WELLINGBOROUGH,
      plannedTravelMinutes: 8,
      navMode: walk,
      station: null,
      role: "stop",
    },
  ];

  return (
    <div className="cc-screen">
      <header>
        <span className="cc-eyebrow" style={{ color: "var(--gold-2)" }}>
          Personal · Today · Preview
        </span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          Right now
        </h1>
      </header>

      <ActiveTile
        headline="Getting you ready"
        sub="Project review · sample day"
        nextAnchor={nextAnchor}
        leaveBy={at(12)}
        urgency="urgent"
      />

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <span className="cc-eyebrow" style={{ color: "var(--gold-2)" }}>
          Ready when you are
        </span>
        <Pass ticket={ticket} boarding={boarding} />
      </section>

      <TodaySpine anchors={spineAnchors} nextId="demo-luton" />

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <Link href={"/plan" as Route} className="cc-btn cc-btn-gold">
          Open the plan
        </Link>
        <Link href={"/navigate" as Route} className="cc-btn">
          Navigate
        </Link>
      </div>

      <p style={{ fontSize: "var(--fs-micro)", color: "var(--ink-faint, var(--ink-dim))", marginTop: "var(--space-2)" }}>
        Sample day for design review — not your real plan. Live platform, the named train and the
        wrong-train guard populate from National Rail on a real journey.
      </p>
    </div>
  );
}
