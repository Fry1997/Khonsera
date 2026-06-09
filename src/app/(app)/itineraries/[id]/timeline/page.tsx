import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import {
  AnchorCard,
  LegCard,
  GapCard,
  IntentionCard,
} from "@/components/concierge";
import type {
  AnchorVM,
  AnchorType,
  LegVM,
  LegMode,
  GapVM,
  IntentionVM,
} from "@/components/concierge";

// Timeline — the primary surface (handover §5), composed of the contract cards
// from a real journey. The key signal: between two anchors, a resolved transition
// renders as a LegCard; the ABSENCE of one renders as a ghosted GapCard
// ("needs input"). Reads flow through the migration-0030 RLS boundary.

function mapStopType(type: string): AnchorType {
  if (type.includes("appointment")) return "appointment";
  if (type.includes("flight")) return "flight";
  if (type.includes("arrival") || type.includes("transit")) return "transport_arrival";
  if (type.includes("checkin") || type.includes("check_in")) return "accommodation_check_in";
  if (type.includes("checkout") || type.includes("check_out")) return "accommodation_check_out";
  if (type.includes("hotel") || type.includes("accommodation")) return "accommodation_check_in";
  return "custom";
}

const LEG_MODES: ReadonlySet<string> = new Set([
  "walk", "drive", "taxi", "bus", "tube", "train", "flight", "mixed",
]);
function mapLegMode(mode: string): LegMode {
  return (LEG_MODES.has(mode) ? mode : "mixed") as LegMode;
}

type StopRow = {
  id: string;
  sequence: number;
  type: string;
  title: string | null;
  start_time: string | null;
  location: { name?: string } | null;
};
type TransitionRow = {
  from_stop_id: string;
  to_stop_id: string;
  mode: string;
  is_locked: boolean | null;
  computed_duration_minutes: number | null;
};

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUserContext();
  const supabase = await createClient();

  const { data: journey } = await supabase
    .from("itineraries")
    .select("id, title, mode, date_start, date_end")
    .eq("id", id)
    .maybeSingle();
  if (!journey) notFound();

  const [{ data: stopsData }, { data: transData }, { data: intentData }] =
    await Promise.all([
      supabase
        .from("stops")
        .select("id, sequence, type, title, start_time, location:locations(name)")
        .eq("itinerary_id", id)
        .order("sequence"),
      supabase
        .from("transitions")
        .select("from_stop_id, to_stop_id, mode, is_locked, computed_duration_minutes")
        .eq("itinerary_id", id),
      supabase
        .from("intentions")
        .select("id, description, target, buffer_minutes, state, flexibility, leave_by")
        .eq("itinerary_id", id),
    ]);

  const stops = (stopsData ?? []) as StopRow[];
  const transitions = (transData ?? []) as TransitionRow[];
  const transByPair = new Map<string, TransitionRow>();
  for (const t of transitions) transByPair.set(`${t.from_stop_id}->${t.to_stop_id}`, t);

  const anchorOf = (s: StopRow): AnchorVM => ({
    id: s.id,
    type: mapStopType(s.type),
    title: s.title ?? s.location?.name ?? "Stop",
    place: s.location?.name ?? undefined,
    time: s.start_time ? { from: s.start_time } : undefined,
    fixed: true,
  });

  const legOf = (t: TransitionRow, from: StopRow, to: StopRow): LegVM => ({
    id: `${t.from_stop_id}->${t.to_stop_id}`,
    mode: mapLegMode(t.mode),
    fromLabel: from.title ?? from.location?.name ?? "—",
    toLabel: to.title ?? to.location?.name ?? "—",
    departure: from.start_time ?? undefined,
    arrival: to.start_time ?? undefined,
    notes: t.computed_duration_minutes ? `${t.computed_duration_minutes} min` : undefined,
    bookingStatus: t.is_locked ? "booked_in_app" : "manual",
  });

  const intentions: IntentionVM[] = (intentData ?? []).map((i) => ({
    id: i.id as string,
    description: i.description as string,
    target: (i.target as string | null) ?? undefined,
    bufferMinutes: (i.buffer_minutes as number | null) ?? undefined,
    state: i.state as IntentionVM["state"],
    flexibility: i.flexibility as IntentionVM["flexibility"],
    leaveBy: (i.leave_by as string | null) ?? undefined,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <header className="flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
            {journey.mode === "work" ? "Work" : "Personal"} · Timeline
          </span>
          <h1 className="h1" style={{ marginTop: 6 }}>
            {journey.title ?? "Your journey"}
          </h1>
        </div>
        <Link href={`/itineraries/${id}` as Route} className="btn btn-ghost btn-sm">
          Edit
        </Link>
      </header>

      {intentions.length > 0 ? (
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div className="desk-flank"><span>Intentions</span></div>
          {intentions.map((i) => (
            <IntentionCard key={i.id} intention={i} />
          ))}
        </section>
      ) : null}

      <section className="k-timeline" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <div className="desk-flank"><span>The chain · {stops.length}</span></div>
        {stops.length === 0 ? (
          <div className="j-card p-6" style={{ textAlign: "center" }}>
            <p className="small">
              Nothing on this journey yet. Add an anchor and it takes shape.
            </p>
          </div>
        ) : (
          stops.map((s, i) => {
            const next = stops[i + 1];
            const trans = next ? transByPair.get(`${s.id}->${next.id}`) : undefined;
            return (
              <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <AnchorCard anchor={anchorOf(s)} />
                {next ? (
                  trans ? (
                    <LegCard leg={legOf(trans, s, next)} />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <GapCard
                        gap={{
                          id: `gap-${s.id}-${next.id}`,
                          type: "transport_gap",
                          fromLabel: s.title ?? s.location?.name ?? "here",
                          toLabel: next.title ?? next.location?.name ?? "next",
                          state: "open",
                        } satisfies GapVM}
                      />
                      <Link href={"/compare" as Route} className="small" style={{ color: "var(--gold-2)", paddingLeft: "var(--space-1)" }}>
                        See travel options
                      </Link>
                    </div>
                  )
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
