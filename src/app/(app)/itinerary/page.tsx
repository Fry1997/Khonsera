import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz, formatTimeInTz } from "@/lib/types/time";

type ItineraryRow = {
  trip_id: string;
  trip_status: string;
  visit_id: string;
  visit_title: string | null;
  visit_status: string;
  customer_name: string;
  proposed_start_time: string | null;
  option_id: string;
  option_mode: string;
  leave_origin_at: string | null;
  arrive_site_at: string | null;
  meeting_start_at: string | null;
  meeting_end_at: string | null;
  leave_site_at: string | null;
  arrive_return_location_at: string | null;
  total_cost_estimate: number | null;
  currency: string;
  booking_status: string | null;
};

export default async function ItineraryPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const { data: trips } = await supabase
    .from("saved_trips")
    .select(
      `id, status,
       visit:visit_plans!inner(id, title, status, proposed_start_time, customer:customers(name)),
       selected_option:travel_options!saved_trips_selected_travel_option_id_fkey(
         id, mode, leave_origin_at, arrive_site_at, meeting_start_at,
         meeting_end_at, leave_site_at, arrive_return_location_at,
         total_cost_estimate, currency
       )`,
    )
    .eq("workspace_id", ctx.workspaceId)
    .in("status", ["upcoming", "ready", "in_progress"])
    .order("created_at");

  const { data: bookings } = await supabase
    .from("booking_intents")
    .select("visit_plan_id, status")
    .eq("workspace_id", ctx.workspaceId);
  const bookingByVisit = new Map(
    (bookings ?? []).map((b) => [b.visit_plan_id, b.status as string]),
  );

  type RawTrip = {
    id: string;
    status: string;
    visit: {
      id: string;
      title: string | null;
      status: string;
      proposed_start_time: string | null;
      customer?: { name?: string } | null;
    } | null;
    selected_option: {
      id: string;
      mode: string;
      leave_origin_at: string | null;
      arrive_site_at: string | null;
      meeting_start_at: string | null;
      meeting_end_at: string | null;
      leave_site_at: string | null;
      arrive_return_location_at: string | null;
      total_cost_estimate: number | null;
      currency: string;
    } | null;
  };

  const rows: ItineraryRow[] = ((trips as unknown as RawTrip[]) ?? [])
    .filter((t) => t.visit && t.selected_option)
    .map((t) => ({
      trip_id: t.id,
      trip_status: t.status,
      visit_id: t.visit!.id,
      visit_title: t.visit!.title,
      visit_status: t.visit!.status,
      customer_name: t.visit!.customer?.name ?? "Customer",
      proposed_start_time: t.visit!.proposed_start_time,
      option_id: t.selected_option!.id,
      option_mode: t.selected_option!.mode,
      leave_origin_at: t.selected_option!.leave_origin_at,
      arrive_site_at: t.selected_option!.arrive_site_at,
      meeting_start_at: t.selected_option!.meeting_start_at,
      meeting_end_at: t.selected_option!.meeting_end_at,
      leave_site_at: t.selected_option!.leave_site_at,
      arrive_return_location_at: t.selected_option!.arrive_return_location_at,
      total_cost_estimate: t.selected_option!.total_cost_estimate,
      currency: t.selected_option!.currency,
      booking_status: bookingByVisit.get(t.visit!.id) ?? null,
    }))
    .sort((a, b) =>
      (a.proposed_start_time ?? "").localeCompare(b.proposed_start_time ?? ""),
    );

  return (
    <PageShell
      title="My itinerary"
      description="Confirmed visits, what's next and when to leave."
      actions={
        <Link href="/visits/new" className="btn-terra">
          + Plan new visit
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="j-card-soft p-8 text-center">
          <p className="body mb-2">No upcoming trips yet.</p>
          <p className="small">
            Confirmed visits land here. Start by planning one.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((r) => (
            <ItineraryCard key={r.trip_id} row={r} timezone={wsCfg.timezone} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function ItineraryCard({
  row,
  timezone,
}: {
  row: ItineraryRow;
  timezone: string;
}) {
  const cost = row.total_cost_estimate
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: row.currency ?? "GBP",
      }).format(row.total_cost_estimate)
    : null;
  const needsBooking = row.option_mode === "rail" && row.booking_status !== "booked";

  return (
    <article className="j-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="uc mb-1">
            {row.proposed_start_time
              ? formatDateInTz(new Date(row.proposed_start_time), timezone)
              : "No date"}
          </p>
          <h3 className="h2">{row.customer_name}</h3>
          {row.visit_title && row.visit_title !== row.customer_name ? (
            <p className="small">{row.visit_title}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="chip">{row.option_mode}</span>
          {needsBooking ? (
            <span className="chip" style={{ color: "var(--terra-deep)", background: "var(--rust-2)" }}>
              <span className="dot" />
              Booking pending
            </span>
          ) : row.booking_status === "booked" ? (
            <span className="chip" style={{ color: "var(--sage)", background: "var(--sage-2)" }}>
              <span className="dot" />
              Booked
            </span>
          ) : null}
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Leave" value={fmt(row.leave_origin_at, timezone)} />
        <Stat label="Arrive" value={fmt(row.arrive_site_at, timezone)} />
        <Stat label="Meeting" value={`${fmt(row.meeting_start_at, timezone)} – ${fmt(row.meeting_end_at, timezone)}`} />
        <Stat label="Leave site" value={fmt(row.leave_site_at, timezone)} />
        <Stat label="Home" value={fmt(row.arrive_return_location_at, timezone)} />
      </div>

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
        <div className="flex flex-wrap items-baseline gap-3">
          {cost ? (
            <span className="mono text-base font-medium text-ink">{cost}</span>
          ) : null}
          <span className="small">trip status: {row.trip_status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {needsBooking ? (
            <Link href={`/visits/${row.visit_id}/booking`} className="btn-terra">
              Book rail
            </Link>
          ) : null}
          <Link href={`/visits/${row.visit_id}/travel-day`} className="btn-ghost">
            Travel-day view
          </Link>
          <Link href={`/visits/${row.visit_id}`} className="btn-ghost">
            Open
          </Link>
        </div>
      </footer>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="uc mb-1">{label}</p>
      <p className="mono text-sm text-ink">{value}</p>
    </div>
  );
}

function fmt(iso: string | null, tz: string): string {
  if (!iso) return "—";
  return formatTimeInTz(new Date(iso), tz);
}
