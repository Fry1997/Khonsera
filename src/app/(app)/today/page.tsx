import Link from "next/link";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { ActiveTile, AnchorCard } from "@/components/concierge";
import type { AnchorVM, AnchorType } from "@/components/concierge";

// Today / Live — the day-of hero surface (build spine §5). Composes the new
// contract components (ActiveTile, AnchorCard) from the user's nearest live
// journey. Reads flow through the migration-0030 RLS boundary, so this page is
// also the end-to-end proof that the privacy layer didn't break legitimate access.

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
  location: { name?: string } | null;
};

export default async function TodayPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
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
  if (live?.id) {
    const { data } = await supabase
      .from("stops")
      .select("id, type, title, start_time, location:locations(name)")
      .eq("itinerary_id", live.id)
      .order("sequence");
    stops = (data ?? []) as never;
  }

  const anchors: AnchorVM[] = stops.map((s) => ({
    id: s.id,
    type: mapStopType(s.type),
    title: s.title ?? s.location?.name ?? "Stop",
    place: s.location?.name ?? undefined,
    time: s.start_time ? { from: s.start_time } : undefined,
    fixed: true,
  }));

  // Naive "next anchor" = first stop still ahead of now.
  const nextAnchor =
    anchors.find((a) => a.time && new Date(a.time.from) >= now) ?? anchors[0];
  const firstLeave = anchors[0]?.time?.from;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <header className="flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
            Today
          </span>
          <h1 className="h1" style={{ marginTop: 6 }}>
            Right now
          </h1>
        </div>
        <span className={live?.mode === "work" ? "pill" : "pill pill-sage"}>
          {live?.mode ?? "personal"}
        </span>
      </header>

      {live ? (
        <>
          <ActiveTile
            headline={live.title ?? "Your journey"}
            nextAnchor={nextAnchor}
            leaveBy={firstLeave}
            urgency="comfortable"
          />

          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div className="desk-flank">
              <span>The chain · {anchors.length}</span>
            </div>
            {anchors.map((a) => (
              <AnchorCard key={a.id} anchor={a} />
            ))}
          </section>

          <Link href={`/itineraries/${live.id}` as Route} className="btn btn-ghost">
            Open full journey
          </Link>
        </>
      ) : (
        <div className="j-card p-6" style={{ textAlign: "center" }}>
          <h2 className="h2">Nothing live right now</h2>
          <p className="small" style={{ margin: "10px auto 18px", maxWidth: "40ch" }}>
            When a journey is planned and the day arrives, Khonsera brings it here —
            the next move, the leave-by, and the chain ahead.
          </p>
          <Link href={"/itineraries/new" as Route} className="btn btn-gold">
            Plan a journey
          </Link>
        </div>
      )}
    </div>
  );
}
