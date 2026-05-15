import type { AviationFlight, AirportLeg } from "@/lib/aviationstack/client";

const STATUS_TAG: Record<string, string> = {
  scheduled: "tag-tight",
  active: "tag-ok solid",
  landed: "tag-ok",
  cancelled: "tag-no solid",
  incident: "tag-no",
  diverted: "tag-no",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  active: "In the air",
  landed: "Landed",
  cancelled: "Cancelled",
  incident: "Incident",
  diverted: "Diverted",
};

export function FlightStatusCard({ flight }: { flight: AviationFlight }) {
  const status = flight.flight_status ?? "scheduled";
  return (
    <article className="j-card p-5">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="uc mb-1">
            {flight.airline?.name ?? flight.airline?.iata ?? "Airline"} ·{" "}
            <span className="mono">
              {flight.flight?.iata ?? flight.flight?.number ?? "—"}
            </span>
          </p>
          <h3 className="h3">
            {flight.departure.iata ?? "???"} → {flight.arrival.iata ?? "???"}
          </h3>
          {flight.flight_date ? (
            <p className="small">{flight.flight_date}</p>
          ) : null}
        </div>
        <span
          className={`${STATUS_TAG[status] ?? "tag-tight"} mono rounded-sm px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider`}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <LegCard label="Departure" leg={flight.departure} />
        <LegCard label="Arrival" leg={flight.arrival} />
      </div>
    </article>
  );
}

function LegCard({ label, leg }: { label: string; leg: AirportLeg }) {
  const scheduled = leg.scheduled ? fmtTime(leg.scheduled) : "—";
  const estimated = leg.estimated && leg.estimated !== leg.scheduled
    ? fmtTime(leg.estimated)
    : null;
  const actual = leg.actual ? fmtTime(leg.actual) : null;
  return (
    <div className="rounded border border-rule bg-card-2 p-4">
      <p className="uc mb-2">{label}</p>
      <p className="h3">{leg.airport ?? "—"}</p>
      <p className="small">
        {leg.iata}
        {leg.icao ? ` · ${leg.icao}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <span className="mono text-lg text-ink">{scheduled}</span>
        {estimated ? (
          <span className="small">
            est. <span className="mono">{estimated}</span>
          </span>
        ) : null}
        {actual ? (
          <span className="small text-sage">
            actual <span className="mono">{actual}</span>
          </span>
        ) : null}
        {leg.delay && leg.delay > 0 ? (
          <span className="small text-rust">+{leg.delay} min</span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {leg.terminal ? <Pill label="Terminal" value={leg.terminal} /> : null}
        {leg.gate ? <Pill label="Gate" value={leg.gate} /> : null}
        {leg.timezone ? <Pill label="TZ" value={leg.timezone} /> : null}
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="chip">
      <span className="uc mr-1">{label}</span>
      <span className="mono">{value}</span>
    </span>
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
