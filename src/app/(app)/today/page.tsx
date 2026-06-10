import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { isWelcomed } from "@/lib/welcome";
import { ActiveTile, AnchorCard } from "@/components/concierge";
import type { AnchorVM, AnchorType, TicketVM } from "@/components/concierge";
import { projectToday, type ProjectionStop, type TodayUrgency } from "@/lib/planning/today";
import { loadJourneyTickets } from "@/lib/actions/wallet";
import { ticketUseMoment } from "@/components/concierge";
import { TodayDocument } from "@/components/today/today-document";

// Today / Live — the day-of surface, rendered purely as a PROJECTION of the plan
// (planner master brief §8). The engine selects which of the four states is
// active from current time vs the plan; nothing here is authored in Today.

function mapStopType(type: string): AnchorType {
  if (type.includes("appointment")) return "appointment";
  if (type.includes("flight")) return "flight";
  if (type.includes("arrival") || type.includes("transit")) return "transport_arrival";
  if (type.includes("checkin") || type.includes("check_in")) return "accommodation_check_in";
  if (type.includes("checkout") || type.includes("check_out")) return "accommodation_check_out";
  if (type.includes("hotel") || type.includes("accommodation")) return "accommodation_check_in";
  return "custom";
}

type StopRow = {
  id: string;
  type: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  location: { name?: string } | null;
};

const STATE_HEADLINE: Record<string, string> = {
  dormant: "Nothing in motion right now",
  readiness: "Getting you ready",
  "in-transit": "On your way",
  arrived: "You're here",
};

export default async function TodayPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  if (!(await isWelcomed())) {
    const { count } = await supabase.from("itineraries").select("id", { count: "exact", head: true });
    if (!count) redirect("/welcome" as Route);
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { data: live } = await supabase
    .from("itineraries")
    .select("id, title, mode, date_start, date_end")
    .eq("mode", ctx.activeMode)
    .gte("date_end", today)
    .in("status", ["planned", "in_progress"])
    .order("date_start")
    .limit(1)
    .maybeSingle();

  let stops: StopRow[] = [];
  let legFromStops = new Set<string>();
  let tickets: TicketVM[] = [];
  if (live?.id) {
    const [{ data: s }, { data: t }, jt] = await Promise.all([
      supabase
        .from("stops")
        .select("id, type, title, start_time, end_time, location:locations(name)")
        .eq("itinerary_id", live.id)
        .order("sequence"),
      supabase.from("transitions").select("from_stop_id").eq("itinerary_id", live.id),
      loadJourneyTickets(live.id),
    ]);
    stops = (s ?? []) as never;
    legFromStops = new Set((t ?? []).map((r) => r.from_stop_id as string));
    tickets = jt;
  }

  const anchors: AnchorVM[] = stops.map((s) => ({
    id: s.id,
    type: mapStopType(s.type),
    title: s.title ?? s.location?.name ?? "Stop",
    place: s.location?.name ?? undefined,
    time: s.start_time ? { from: s.start_time, to: s.end_time ?? undefined } : undefined,
    fixed: true,
  }));

  const projStops: ProjectionStop[] = stops.map((s) => ({
    id: s.id,
    title: s.title ?? s.location?.name ?? "Stop",
    start: s.start_time,
    end: s.end_time,
    hasLegAfter: legFromStops.has(s.id),
  }));
  const proj = projectToday(projStops, now.getTime());

  const nextAnchor = proj.nextIndex != null ? anchors[proj.nextIndex] : undefined;

  // Promote the next booked document (soonest use-moment from now on).
  const nowMs = now.getTime();
  const nextTicket =
    tickets
      .map((tk) => ({ tk, m: ticketUseMoment(tk) }))
      .filter((x): x is { tk: TicketVM; m: string } => Boolean(x.m))
      .filter((x) => new Date(x.m).getTime() >= nowMs - 30 * 60000)
      .sort((a, b) => a.m.localeCompare(b.m))[0]?.tk ?? tickets[0];

  return (
    <div className="cc-screen">
      <header>
        <span className="cc-eyebrow">{ctx.activeMode === "work" ? "Work" : "Personal"} · Today</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          Right now
        </h1>
      </header>

      {live && stops.length ? (
        <>
          <ActiveTile
            headline={STATE_HEADLINE[proj.state] ?? live.title ?? "Your day"}
            sub={live.title ?? undefined}
            nextAnchor={nextAnchor}
            leaveBy={proj.leaveByIso ?? undefined}
            urgency={proj.urgency as TodayUrgency}
          />

          {(proj.state === "readiness" || proj.state === "in-transit") && nextTicket ? (
            <TodayDocument ticket={nextTicket} />
          ) : null}

          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div className="cc-eyebrow">The chain · {anchors.length}</div>
            {anchors.map((a) => (
              <AnchorCard key={a.id} anchor={a} />
            ))}
          </section>

          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Link href={"/plan" as Route} className="cc-btn cc-btn-gold">
              Open the plan
            </Link>
          </div>
        </>
      ) : (
        <div className="cc-active-tile" data-urgency="comfortable">
          <span className="cc-at-status">
            <span className="cc-at-dot" />
            At rest
          </span>
          <h2 className="cc-at-headline">Nothing live right now</h2>
          <p className="cc-at-sub">
            When a journey is planned and the day arrives, Khonsera brings it here — the next move, the
            leave-by, and the chain ahead.
          </p>
          <div style={{ marginTop: "var(--space-4)" }}>
            <Link href={"/plan" as Route} className="cc-btn cc-btn-gold">
              Plan a day
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
