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
import { LiveStatus } from "@/components/plan/live-status";
import { foldStopsToTickets } from "@/lib/tickets/from-stops";

const londonHHMM = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
    : null;

// Today / Live — the day-of surface, rendered purely as a PROJECTION of the plan
// (proposal §7 / brief §8). Today projects EVERY Event whose span covers today —
// no "publish" toggle, no status trap (the lifecycle dead-end is gone) — and
// COMPOSES overlapping Events into one timeline (E1). The engine picks the state.

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

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isToday(iso: string | null, today: string): boolean {
  if (!iso) return false;
  return new Date(iso).toISOString().slice(0, 10) === today || ymd(new Date(iso)) === today;
}

export default async function TodayPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  if (!(await isWelcomed())) {
    const { count } = await supabase.from("itineraries").select("id", { count: "exact", head: true });
    if (!count) redirect("/welcome" as Route);
  }

  const now = new Date();
  const today = ymd(now);

  // Every Event whose span covers today — any active status (no publish toggle).
  const { data: events } = await supabase
    .from("itineraries")
    .select("id, title, mode, date_start, date_end, status")
    .eq("mode", ctx.activeMode)
    .lte("date_start", today)
    .gte("date_end", today)
    .in("status", ["draft", "planning", "planned", "in_progress"])
    .order("date_start", { ascending: true });

  const covering = events ?? [];

  // Compose today's slice across all covering Events (E1).
  const allStops: StopRow[] = [];
  const legFromStops = new Set<string>();
  let tickets: TicketVM[] = [];
  for (const ev of covering) {
    const [{ data: s }, { data: t }, jt] = await Promise.all([
      supabase
        .from("stops")
        .select("id, type, title, start_time, end_time, location:locations(name)")
        .eq("itinerary_id", ev.id)
        .order("sequence"),
      supabase.from("transitions").select("from_stop_id").eq("itinerary_id", ev.id),
      loadJourneyTickets(ev.id),
    ]);
    for (const st of (s ?? []) as unknown as StopRow[]) {
      if (isToday(st.start_time, today)) allStops.push(st);
    }
    for (const tr of t ?? []) legFromStops.add(tr.from_stop_id as string);
    tickets = tickets.concat(jt);
  }

  allStops.sort((a, b) => {
    const ta = a.start_time ? new Date(a.start_time).getTime() : Infinity;
    const tb = b.start_time ? new Date(b.start_time).getTime() : Infinity;
    return ta - tb;
  });

  const anchors: AnchorVM[] = allStops.map((s) => ({
    id: s.id,
    type: mapStopType(s.type),
    title: s.title ?? s.location?.name ?? "Stop",
    place: s.location?.name ?? undefined,
    time: s.start_time ? { from: s.start_time, to: s.end_time ?? undefined } : undefined,
    fixed: true,
  }));

  const projStops: ProjectionStop[] = allStops.map((s) => ({
    id: s.id,
    title: s.title ?? s.location?.name ?? "Stop",
    start: s.start_time,
    end: s.end_time,
    hasLegAfter: legFromStops.has(s.id),
  }));
  const proj = projectToday(projStops, now.getTime());
  const nextAnchor = proj.nextIndex != null ? anchors[proj.nextIndex] : undefined;

  const nowMs = now.getTime();
  const nextTicket =
    tickets
      .map((tk) => ({ tk, m: ticketUseMoment(tk) }))
      .filter((x): x is { tk: TicketVM; m: string } => Boolean(x.m))
      .filter((x) => new Date(x.m).getTime() >= nowMs - 30 * 60000)
      .sort((a, b) => a.m.localeCompare(b.m))[0]?.tk ?? tickets[0];

  // Live status seed for the surfaced ticket: one boarding per departure +
  // changeover (the ticket id IS the departure stop id). Resolve the run's stops
  // to get each boarding station's CRS + onward time.
  let liveBoardings: Array<{ crs: string | null; time: string | null; label: string }> | undefined;
  if (nextTicket) {
    const { data: depRow } = await supabase.from("stops").select("itinerary_id").eq("id", nextTicket.id).maybeSingle();
    if (depRow?.itinerary_id) {
      const { data: runStops } = await supabase
        .from("stops")
        .select("id, type, title, start_time, end_time, metadata, transport_hub:transport_hubs(code)")
        .eq("itinerary_id", depRow.itinerary_id)
        .order("sequence");
      const rows = (runStops ?? []) as unknown as Array<{
        id: string; type: string; title: string | null; start_time: string | null; end_time: string | null;
        metadata: Record<string, unknown> | null; transport_hub: { code?: string | null } | null;
      }>;
      const byId = new Map(rows.map((s) => [s.id, s]));
      const run = foldStopsToTickets(rows.map((s) => ({ id: s.id, type: s.type, title: s.title, start_time: s.start_time, metadata: s.metadata })))
        .find((f) => f.departureStopId === nextTicket.id);
      if (run) {
        liveBoardings = run.stopIds
          .map((sid) => byId.get(sid))
          .filter((st): st is NonNullable<typeof st> => Boolean(st) && st!.type !== "transit_arrival")
          .map((st) => ({
            crs: st.transport_hub?.code ?? null,
            time: londonHHMM(st.type === "transit_changeover" ? st.end_time : st.start_time),
            label: st.title ?? "",
          }));
      }
    }
  }

  const sub =
    covering.length === 1
      ? covering[0].title ?? undefined
      : covering.length > 1
        ? `${covering.length} plans today`
        : undefined;

  return (
    <div className="cc-screen">
      <header>
        <span className="cc-eyebrow">{ctx.activeMode === "work" ? "Work" : "Personal"} · Today</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          Right now
        </h1>
      </header>

      {anchors.length ? (
        <>
          <ActiveTile
            headline={STATE_HEADLINE[proj.state] ?? "Your day"}
            sub={sub}
            nextAnchor={nextAnchor}
            leaveBy={proj.leaveByIso ?? undefined}
            urgency={proj.urgency as TodayUrgency}
          />

          {(proj.state === "readiness" || proj.state === "in-transit") && nextTicket ? (
            <>
              <TodayDocument ticket={nextTicket} />
              {liveBoardings?.map((b, i) => (
                <LiveStatus key={i} crs={b.crs} time={b.time} label={i === 0 ? null : b.label} />
              ))}
            </>
          ) : null}

          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div className="cc-eyebrow">Today · {anchors.length}</div>
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
          <h2 className="cc-at-headline">Nothing on today</h2>
          <p className="cc-at-sub">
            When a day you&apos;ve planned arrives, Khonsera brings it here — the next move, the
            leave-by, and the chain ahead.
          </p>
          <div style={{ marginTop: "var(--space-4)" }}>
            <Link href={"/plan" as Route} className="cc-btn cc-btn-gold">
              Open the plan
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
