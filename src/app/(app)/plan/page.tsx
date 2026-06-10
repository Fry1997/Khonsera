import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { JourneyListCard, type JourneyVM } from "@/components/concierge";
import { PlanCreate } from "@/components/plan/plan-create";
import { RemindersStrip } from "@/components/plan/reminders-strip";
import { loadReminders } from "@/lib/actions/reminders";

// Plan — the INDEX of Events (proposal §3a). The two-level structure that fixes
// the singleton bug: this lists every Event (a day or a multi-day trip) hinged
// and grouped by start date; you pick one (→ /plan/[id]) or start a new one.
// Grouped Today / This week / Later / Past→archive, mirroring the Wallet (§4).

type ItinRow = {
  id: string;
  title: string | null;
  mode: string;
  date_start: string;
  date_end: string;
  status: string;
};

type Group = { key: string; label: string; items: JourneyVM[] };

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function PlanIndexPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("itineraries")
    .select("id, title, mode, date_start, date_end, status")
    .eq("mode", ctx.activeMode)
    .order("date_start", { ascending: true });

  const itins = (rows ?? []) as ItinRow[];
  const ids = itins.map((i) => i.id);

  // Two roll-up queries (not N+1): stop counts, and which stops have an
  // onward transition (so we can show "n to resolve").
  const counts = new Map<string, number>();
  const withLeg = new Map<string, Set<string>>();
  if (ids.length) {
    const [{ data: stops }, { data: trans }] = await Promise.all([
      supabase.from("stops").select("id, itinerary_id").in("itinerary_id", ids),
      supabase.from("transitions").select("itinerary_id, from_stop_id").in("itinerary_id", ids),
    ]);
    for (const s of stops ?? []) counts.set(s.itinerary_id as string, (counts.get(s.itinerary_id as string) ?? 0) + 1);
    for (const t of trans ?? []) {
      const set = withLeg.get(t.itinerary_id as string) ?? new Set<string>();
      set.add(t.from_stop_id as string);
      withLeg.set(t.itinerary_id as string, set);
    }
  }

  const toVM = (i: ItinRow): JourneyVM => ({
    id: i.id,
    title: i.title ?? "",
    mode: i.mode === "work" ? "work" : "personal",
    dateStart: i.date_start,
    dateEnd: i.date_end,
    status: i.status,
    anchorCount: counts.get(i.id) ?? 0,
    openGapCount: 0, // refined in a later chunk; kept calm for now
  });

  // Grouping by span vs today (mirrors the Wallet's day grouping).
  const today = ymd(new Date());
  const weekEnd = ymd(new Date(Date.now() + 7 * 86_400_000));
  const groups: Group[] = [
    { key: "today", label: "Today", items: [] },
    { key: "week", label: "This week", items: [] },
    { key: "later", label: "Later", items: [] },
  ];
  const archive: JourneyVM[] = [];
  for (const i of itins) {
    const vm = toVM(i);
    if (i.date_end < today) archive.push(vm);
    else if (i.date_start <= today) groups[0].items.push(vm);
    else if (i.date_start <= weekEnd) groups[1].items.push(vm);
    else groups[2].items.push(vm);
  }
  const liveGroups = groups.filter((g) => g.items.length);
  archive.reverse(); // most-recent past first

  const empty = itins.length === 0;
  const reminders = await loadReminders();

  return (
    <div className="cc-screen">
      <header>
        <span className="cc-eyebrow">{ctx.activeMode === "work" ? "Work" : "Personal"} · Plan</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          What are you planning?
        </h1>
      </header>

      <PlanCreate />

      <RemindersStrip initial={reminders} />

      {empty ? (
        <div className="cc-plan-empty">
          <p className="cc-plan-empty-lead">Nothing planned yet.</p>
          <p className="cc-plan-empty-sub">
            Start a day or a trip above — give it a date, and Khonsera threads the rest.
          </p>
        </div>
      ) : (
        <>
          {liveGroups.map((g) => (
            <section key={g.key} className="cc-plan-group">
              <div className="cc-plan-group-head">{g.label}</div>
              <div className="cc-plan-list">
                {g.items.map((vm) => (
                  <JourneyListCard key={vm.id} journey={vm} />
                ))}
              </div>
            </section>
          ))}

          {archive.length ? (
            <section className="cc-plan-group cc-plan-archive">
              <div className="cc-plan-group-head">Past</div>
              <div className="cc-plan-list">
                {archive.map((vm) => (
                  <JourneyListCard key={vm.id} journey={vm} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
