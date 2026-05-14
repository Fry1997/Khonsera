import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatTimeInTz, formatDateInTz } from "@/lib/types/time";
import { MarkAsBookedForm } from "./mark-as-booked-form";

export default async function BookingHandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const { data: visit } = await supabase
    .from("visit_plans")
    .select(
      `id, title, status,
       customer:customers(name),
       saved_trip:saved_trips(id, selected_travel_option_id),
       customer_site:customer_sites(name, address)`,
    )
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!visit) notFound();

  const tripData = visit.saved_trip as unknown as {
    id: string;
    selected_travel_option_id: string | null;
  } | null;
  if (!tripData?.selected_travel_option_id) {
    return (
      <PageShell title="Book rail travel">
        <div className="j-card-soft p-6">
          <p className="body">
            This visit doesn&apos;t have a selected travel option yet. Confirm
            one first.
          </p>
          <Link href={`/visits/${id}`} className="btn-ghost mt-3">
            Back to visit
          </Link>
        </div>
      </PageShell>
    );
  }

  const { data: option } = await supabase
    .from("travel_options")
    .select(
      `id, mode, total_cost_estimate, currency,
       leave_origin_at, arrive_site_at,
       meeting_start_at, meeting_end_at,
       leave_site_at, arrive_return_location_at,
       journey_legs(sequence, leg_type, start_location_name, end_location_name,
         start_time, end_time, duration_minutes, service_number)`,
    )
    .eq("id", tripData.selected_travel_option_id)
    .maybeSingle();
  if (!option) notFound();

  const legs = (option.journey_legs ?? [])
    .filter((l) => l.leg_type === "train")
    .sort((a, b) => a.sequence - b.sequence);
  const outbound = legs[0] ?? null;
  const inbound = legs[1] ?? null;

  const { data: intent } = await supabase
    .from("booking_intents")
    .select("id, status")
    .eq("visit_plan_id", id)
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: existingBooking } = intent
    ? await supabase
        .from("travel_bookings")
        .select(
          "id, booking_reference, ticket_status, actual_price, currency",
        )
        .eq("booking_intent_id", intent.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const customer =
    (visit.customer as unknown as { name?: string } | null)?.name ?? "Customer";

  const trainlineUrl = (() => {
    if (!outbound) return null;
    const params = new URLSearchParams({
      origin: outbound.start_location_name ?? "",
      destination: outbound.end_location_name ?? "",
      outwardDate: outbound.start_time?.slice(0, 10) ?? "",
      outwardTime: outbound.start_time?.slice(11, 16) ?? "",
    });
    if (inbound) {
      params.set("returnDate", inbound.start_time?.slice(0, 10) ?? "");
      params.set("returnTime", inbound.start_time?.slice(11, 16) ?? "");
    }
    return `https://www.thetrainline.com/book/results?${params.toString()}`;
  })();

  const cost = option.total_cost_estimate
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: option.currency ?? "GBP",
      }).format(option.total_cost_estimate)
    : "Cost TBD";

  return (
    <PageShell
      title="Book rail travel"
      description={`${customer} · ${visit.title ?? "visit"} · selected rail option`}
      actions={
        <Link href={`/visits/${id}`} className="btn-ghost">
          Back to visit
        </Link>
      }
    >
      {option.mode !== "rail" ? (
        <div className="j-card-soft p-5">
          <p className="body">
            This visit&apos;s selected option is <strong>{option.mode}</strong>,
            not rail — no rail booking required. Record any parking or fuel
            expense on the visit page.
          </p>
        </div>
      ) : (
        <>
          <section className="j-card p-6">
            <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="uc mb-1">Journey summary</p>
                <h2 className="h3">
                  {outbound?.start_location_name ?? "Origin"} →{" "}
                  {outbound?.end_location_name ?? "Destination"}
                </h2>
              </div>
              <div className="text-right">
                <p className="mono text-xl text-ink">{cost}</p>
                <p className="small">estimated</p>
              </div>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              {outbound ? (
                <LegSummary
                  direction="Outbound"
                  start={outbound.start_time}
                  end={outbound.end_time}
                  from={outbound.start_location_name}
                  to={outbound.end_location_name}
                  service={outbound.service_number}
                  timezone={wsCfg.timezone}
                />
              ) : null}
              {inbound ? (
                <LegSummary
                  direction="Return"
                  start={inbound.start_time}
                  end={inbound.end_time}
                  from={inbound.start_location_name}
                  to={inbound.end_location_name}
                  service={inbound.service_number}
                  timezone={wsCfg.timezone}
                />
              ) : null}
            </div>
          </section>

          <section className="j-card p-6">
            <h3 className="h3 mb-2">Open with Trainline</h3>
            <p className="small mb-4">
              We&apos;ll open Trainline with this journey&apos;s stations and
              dates pre-filled in the search. Complete the purchase there, then
              come back to record the booking reference below. (Affiliate
              deep-linking with full pre-fill arrives once partner credentials
              are wired up.)
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {trainlineUrl ? (
                <a
                  href={trainlineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-terra"
                >
                  Open Trainline ↗
                </a>
              ) : (
                <span className="small text-ink-faint">
                  Train leg details missing.
                </span>
              )}
              <span className="small">
                Intent status:{" "}
                <span className="mono">{intent?.status ?? "not_started"}</span>
              </span>
            </div>
          </section>

          <section className="j-card p-6">
            <h3 className="h3 mb-2">Mark as booked</h3>
            <p className="small mb-4">
              Once you&apos;ve booked, paste the reference and actual price.
              We&apos;ll save it against this visit and the expense will appear
              automatically.
            </p>
            {existingBooking ? (
              <p className="small mb-3 text-sage">
                Already booked — ref{" "}
                <span className="mono">{existingBooking.booking_reference}</span>
                {existingBooking.actual_price
                  ? `, ${new Intl.NumberFormat("en-GB", {
                      style: "currency",
                      currency: existingBooking.currency ?? "GBP",
                    }).format(existingBooking.actual_price)}`
                  : ""}
                . Re-submit below to record a change.
              </p>
            ) : null}
            <MarkAsBookedForm
              bookingIntentId={intent?.id ?? null}
              defaultPrice={option.total_cost_estimate ?? null}
              currency={option.currency ?? "GBP"}
            />
          </section>
        </>
      )}
    </PageShell>
  );
}

function LegSummary({
  direction,
  start,
  end,
  from,
  to,
  service,
  timezone,
}: {
  direction: string;
  start: string | null;
  end: string | null;
  from: string | null;
  to: string | null;
  service: string | null;
  timezone: string;
}) {
  return (
    <div className="rounded border border-rule bg-card-2 p-4">
      <p className="uc mb-2">{direction}</p>
      <p className="mono text-base text-ink">
        {fmt(start, timezone)} → {fmt(end, timezone)}
      </p>
      <p className="small">
        {from} → {to}
      </p>
      {service ? <p className="tiny mt-1 mono">{service}</p> : null}
      {start ? (
        <p className="tiny mt-1">{formatDateInTz(new Date(start), timezone)}</p>
      ) : null}
    </div>
  );
}

function fmt(iso: string | null, tz: string): string {
  if (!iso) return "—";
  return formatTimeInTz(new Date(iso), tz);
}
