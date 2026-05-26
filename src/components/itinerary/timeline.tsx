"use client";

import type {
  PlacePickerCustomer,
  PlacePickerCustomerSite,
  PlacePickerLocation,
} from "@/components/place-picker";
import { TrainTicketCard } from "@/components/train-ticket-card";
import { GapModePicker } from "@/components/gap-mode-picker";
import { AnchorCard } from "./anchor-card";
import { StopoverCard } from "./stopover-card";
import { TransitionRow } from "./transition-row";
import type { TimelineEntry } from "./types";

export type TimelineProps = {
  entries: TimelineEntry[];
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  datePresets: Array<{ label: string; value: string }>;
  timezone: string;
};

export function Timeline({ entries, ...ctx }: TimelineProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {entries.map((entry, i) => (
        <TimelineEntryRow key={keyFor(entry, i)} entry={entry} ctx={ctx} />
      ))}
    </div>
  );
}

function keyFor(entry: TimelineEntry, i: number): string {
  if ("uid" in entry && entry.uid) return entry.uid;
  if (entry.kind === "day-break") return `day-${entry.date}`;
  return `${entry.kind}-${i}`;
}

type Ctx = Omit<TimelineProps, "entries">;

function TimelineEntryRow({ entry, ctx }: { entry: TimelineEntry; ctx: Ctx }) {
  switch (entry.kind) {
    case "home":
      return <HomeEntry entry={entry} />;
    case "transport":
      return <TransportEntry entry={entry} />;
    case "anchor":
      return <AnchorEntry entry={entry} ctx={ctx} />;
    case "stopover":
      return <StopoverEntry entry={entry} ctx={ctx} />;
    case "hotel":
      return <HotelEntry entry={entry} />;
    case "gap-transition":
      return <GapTransitionEntry entry={entry} />;
    case "gap-mode":
      return <GapModeEntry entry={entry} />;
    case "context-gap":
      return <ContextGapEntry entry={entry} />;
    case "free-time":
      return <FreeTimeEntry entry={entry} />;
    case "day-break":
      return <DayBreakEntry entry={entry} />;
    case "home-return":
      return <HomeReturnEntry entry={entry} />;
    case "add-stop":
      return <AddStopEntry entry={entry} />;
    case "inline-adds":
      return <InlineAddsEntry entry={entry} />;
  }
}

// ─── Entry renderers ─────────────────────────────────────────────────

type E<K extends TimelineEntry["kind"]> = Extract<TimelineEntry, { kind: K }>;

function HomeEntry({ entry }: { entry: E<"home"> }) {
  if (!entry.leaveBy) return null;
  return (
    <div
      style={{
        padding: "8px 0 4px",
        fontSize: 12,
        color: "var(--ink-dim)",
      }}
    >
      <span className="mono" style={{ fontWeight: 500 }}>
        Leave by {entry.leaveBy}
      </span>
      {entry.leaveByDetail && (
        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--ink-faint)" }}>
          {entry.leaveByDetail}
        </span>
      )}
    </div>
  );
}

function TransportEntry({ entry }: { entry: E<"transport"> }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "2px 4px",
          marginBottom: 2,
        }}
      >
        <span className="uc" style={{ fontSize: 10, color: "var(--gold-2)" }}>
          {entry.label}
        </span>
        <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
          {entry.onEdit && (
            <button
              type="button"
              style={{ color: "var(--ink-dim)" }}
              onClick={entry.onEdit}
            >
              Edit
            </button>
          )}
          {entry.onRemove && (
            <button
              type="button"
              style={{ color: "var(--rust)" }}
              onClick={entry.onRemove}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entry.legs.map((leg, li) => (
          <TrainTicketCard key={`${entry.uid}-${li}`} segment={leg} compact />
        ))}
      </div>
    </div>
  );
}

function AnchorEntry({ entry, ctx }: { entry: E<"anchor">; ctx: Ctx }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <AnchorCard
        anchor={entry.anchor}
        earlier={entry.earlier}
        first={entry.earlier.length === 0}
        canRemove={true}
        customers={ctx.customers}
        customerSites={ctx.customerSites}
        locations={ctx.locations}
        datePresets={ctx.datePresets}
        timezone={ctx.timezone}
        mode={entry.expanded ? "expanded" : "summary"}
        onModeChange={entry.onModeChange}
        onChange={entry.onChange ?? (() => {})}
        onRemove={entry.onRemove ?? (() => {})}
      />
      {entry.maximizeInfo && (
        <div
          style={{
            padding: "10px 14px",
            background: "var(--gold-tint)",
            borderRadius: "0 0 12px 12px",
            marginTop: -4,
            borderTop: "1px dashed var(--gold-200)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span
              className="mono"
              style={{ fontSize: 13, fontWeight: 600, color: "var(--gold-2)" }}
            >
              {Math.floor(entry.maximizeInfo.durationMins / 60)}h
              {entry.maximizeInfo.durationMins % 60 > 0
                ? ` ${entry.maximizeInfo.durationMins % 60}m`
                : ""}
            </span>
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-dim)" }}
            >
              {entry.maximizeInfo.arriveBy} — {entry.maximizeInfo.leaveBy}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 3 }}>
            {entry.maximizeInfo.travelNote ??
              "Includes 10 min buffer before departure"}
          </div>
        </div>
      )}
    </div>
  );
}

function StopoverEntry({ entry, ctx }: { entry: E<"stopover">; ctx: Ctx }) {
  return (
    <StopoverCard
      stopover={entry.stopover}
      fromAnchor={entry.fromAnchor}
      toAnchor={entry.toAnchor}
      customers={ctx.customers}
      customerSites={ctx.customerSites}
      locations={ctx.locations}
      backCalc={entry.backCalc}
      mode={entry.expanded ? "expanded" : "summary"}
      onModeChange={entry.onModeChange}
      onChange={entry.onChange ?? (() => {})}
      onRemove={entry.onRemove ?? (() => {})}
    />
  );
}

function HotelEntry({ entry }: { entry: E<"hotel"> }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        className="card"
        style={{
          padding: "12px 16px",
          borderLeft: "3px solid var(--sage)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <span className="uc" style={{ fontSize: 10, color: "var(--sage)" }}>
              {entry.nights > 0
                ? `${entry.nights} night${entry.nights !== 1 ? "s" : ""}`
                : "Hotel"}
            </span>
            <div
              style={{
                fontFamily: "var(--display)",
                fontWeight: 500,
                fontSize: 15,
                color: "var(--ink)",
                marginTop: 2,
              }}
            >
              {entry.label}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
            {entry.onEdit && (
              <button
                type="button"
                style={{ color: "var(--ink-dim)" }}
                onClick={entry.onEdit}
              >
                Edit
              </button>
            )}
            {entry.onRemove && (
              <button
                type="button"
                style={{ color: "var(--rust)" }}
                onClick={entry.onRemove}
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
          Check in from {entry.checkInTime} · Check out by {entry.checkOutTime}
        </div>
        {entry.reference && (
          <div
            style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}
          >
            Ref: {entry.reference}
          </div>
        )}
      </div>
    </div>
  );
}

function GapTransitionEntry({ entry }: { entry: E<"gap-transition"> }) {
  return (
    <>
      <TransitionRow
        from={entry.from}
        to={entry.to}
        transition={entry.transition}
        onChange={entry.onChange}
        fromVirtualLabel={entry.fromVirtualLabel}
        modePreviews={entry.modePreviews}
        onOpenChange={entry.onOpenChange}
      />
      {entry.transitionMeta &&
        (entry.transitionMeta.durationMinutes ||
          entry.transitionMeta.distanceMiles ||
          entry.transitionMeta.feasibility) && (
          <div
            style={{
              marginLeft: 56,
              fontSize: 11.5,
              color: "var(--ink-dim)",
              padding: "2px 0 6px",
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {entry.transitionMeta.durationMinutes ? (
              <span>
                {Math.floor(entry.transitionMeta.durationMinutes / 60) > 0
                  ? `${Math.floor(entry.transitionMeta.durationMinutes / 60)}h `
                  : ""}
                {entry.transitionMeta.durationMinutes % 60}m
              </span>
            ) : null}
            {entry.transitionMeta.distanceMiles ? (
              <span>{entry.transitionMeta.distanceMiles.toFixed(1)} mi</span>
            ) : null}
            {entry.transitionMeta.feasibility && (
              <span
                className={
                  entry.transitionMeta.feasibility.severity === "infeasible"
                    ? "feasibility-flag feasibility-flag-bad"
                    : "feasibility-flag feasibility-flag-tight"
                }
              >
                {entry.transitionMeta.feasibility.message}
              </span>
            )}
          </div>
        )}
    </>
  );
}

function GapModeEntry({ entry }: { entry: E<"gap-mode"> }) {
  return (
    <GapModePicker
      selected={entry.selected}
      onSelect={entry.onSelect}
      previews={entry.previews}
      fromLabel={entry.fromLabel}
      toLabel={entry.toLabel}
    />
  );
}

function ContextGapEntry({ entry }: { entry: E<"context-gap"> }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "10px 0",
        fontSize: 12,
        color: "var(--ink-faint)",
        borderTop: "1px dashed var(--rule)",
        borderBottom: "1px dashed var(--rule)",
        margin: "4px 0",
      }}
    >
      You&apos;re in {entry.location} for {entry.durationLabel}
      <br />
      <button
        type="button"
        className="brief-add-stop-trigger"
        onClick={entry.onAddStop}
        style={{ marginTop: 4 }}
      >
        What are you doing here?
      </button>
    </div>
  );
}

function FreeTimeEntry({ entry }: { entry: E<"free-time"> }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "8px 0",
        fontSize: 12,
        color: "var(--ink-faint)",
      }}
    >
      {entry.durationLabel} free {entry.beforeLabel}
      <br />
      <button
        type="button"
        className="brief-add-stop-trigger"
        onClick={entry.onAddStop}
        style={{ marginTop: 4 }}
      >
        + Add another stop
      </button>
    </div>
  );
}

function DayBreakEntry({ entry }: { entry: E<"day-break"> }) {
  return (
    <div
      style={{
        padding: "12px 0 6px",
        borderTop: "1px solid var(--rule)",
        marginTop: 8,
      }}
    >
      <span
        className="display-i"
        style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}
      >
        {entry.label}
      </span>
    </div>
  );
}

function HomeReturnEntry({ entry }: { entry: E<"home-return"> }) {
  return (
    <div
      style={{
        padding: "10px 16px",
        borderLeft: "3px solid var(--ink-faint)",
        marginTop: 4,
        color: "var(--ink-dim)",
        fontSize: 13,
      }}
    >
      {entry.arriveBy ? (
        <span className="mono" style={{ fontWeight: 500 }}>
          ~{entry.arriveBy} Home
        </span>
      ) : (
        <span>Home</span>
      )}
    </div>
  );
}

function AddStopEntry({ entry }: { entry: E<"add-stop"> }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      <button
        type="button"
        className="brief-add-stop-trigger"
        onClick={entry.onAdd}
      >
        {entry.label}
      </button>
    </div>
  );
}

function InlineAddsEntry({ entry }: { entry: E<"inline-adds"> }) {
  return (
    <div className="anchor-inline-adds">
      <button
        type="button"
        className="brief-add-stop-trigger"
        onClick={entry.onAddAnchor}
      >
        + Add a stop
      </button>
      {entry.onAddStopover && (
        <button
          type="button"
          className="brief-add-stop-trigger"
          onClick={entry.onAddStopover}
          title="Drop in somewhere between these two anchors"
        >
          + Add a stop between these
        </button>
      )}
    </div>
  );
}
