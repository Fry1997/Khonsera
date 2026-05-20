"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FormError } from "@/components/ui/form";
import { createItineraryFromBrief } from "@/lib/actions/itineraries";
import { updateLocationType } from "@/lib/actions/locations";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";
import type { LocationType } from "@/lib/types/domain";

// ─────────────────────────────────────────────────────────────────────
// An "anchor" is one place the trip has to hit. Each anchor's "kind"
// drives which fields render — hotels show check-in/out, stations show
// arrive-by only, everything else gets duration chips. The kind is
// auto-inferred from the picked place's type but the user can override.
// ─────────────────────────────────────────────────────────────────────

type AnchorKind = "appointment" | "hotel" | "station";

type Anchor = {
  uid: string;
  place: PlaceSelection | null;
  // Explicit kind override — null means "follow the inferred place type".
  kindOverride: AnchorKind | null;
  date: string;
  startTime: string;
  // appointment / station only
  durationMins: number;
  // hotel only
  checkOutDate: string;
  checkOutTime: string;
  notes: string;
};

const APPT_DURATIONS: Array<{ label: string; mins: number }> = [
  { label: "30m", mins: 30 },
  { label: "1h", mins: 60 },
  { label: "2h", mins: 120 },
  { label: "Half-day", mins: 240 },
  { label: "Full day", mins: 480 },
];

const TIME_PRESETS = ["09:00", "10:00", "13:00", "18:00", "19:30"];

export function NewItineraryBrief({
  customers,
  customerSites,
  locations,
  timezone,
}: {
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  timezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  const [anchors, setAnchors] = useState<Anchor[]>([
    emptyAnchor(defaultAnchorDate()),
  ]);
  const [titleOverride, setTitleOverride] = useState("");
  const [notes, setNotes] = useState("");
  const [notesOn, setNotesOn] = useState(false);

  const datePresets = useMemo(() => buildDatePresets(timezone), [timezone]);

  const updateAnchor = (uid: string, patch: Partial<Anchor>) => {
    setAnchors((prev) =>
      prev.map((a) => (a.uid === uid ? { ...a, ...patch } : a)),
    );
  };

  const insertAnchorAt = (index: number, anchor?: Anchor) => {
    const previous = anchors[Math.max(0, Math.min(index - 1, anchors.length - 1))];
    const seed = anchor ?? emptyAnchor(previous?.date ?? defaultAnchorDate());
    setAnchors((prev) => {
      const copy = [...prev];
      copy.splice(index, 0, seed);
      return copy;
    });
  };

  const removeAnchor = (uid: string) => {
    setAnchors((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((a) => a.uid !== uid);
    });
  };

  const canSubmit = anchors.every((a) => a.place != null);

  const submit = () => {
    setFeedback(null);

    if (!canSubmit) {
      setFeedback({
        message: "Pick a place for every anchor — that's the bit Khonsera plans around.",
        fieldErrors: { anchors: "required" },
      });
      return;
    }

    startTransition(async () => {
      const result = await createItineraryFromBrief({
        anchors: anchors.map((a) => {
          const kind = effectiveKind(a);
          const placeArgs = a.place
            ? a.place.kind === "location"
              ? { location_id: a.place.location_id, label: a.place.label }
              : a.place.kind === "customer_site"
                ? {
                    customer_site_id: a.place.customer_site_id,
                    customer_id: a.place.customer_id,
                    label: a.place.label,
                  }
                : { customer_id: a.place.customer_id, label: a.place.label }
            : {};
          const base = {
            kind,
            date: a.date,
            start_time: a.startTime,
            notes: null,
            ...placeArgs,
          };
          if (kind === "hotel") {
            return {
              ...base,
              check_out_date: a.checkOutDate || a.date,
              check_out_time: a.checkOutTime || "11:00",
            };
          }
          return {
            ...base,
            duration_minutes: a.durationMins,
          };
        }),
        title: titleOverride.trim() || null,
        notes: notesOn ? notes.trim() || null : null,
        timezone,
      });

      if (!result.ok) {
        setFeedback(feedbackFromError(result.error));
        return;
      }
      router.push(`/itineraries/${result.value.id}`);
      router.refresh();
    });
  };

  return (
    <div className="brief-grid">
      {/* Left — the anchor stack */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormError message={feedback?.message} />

        <header style={{ marginBottom: 4 }}>
          <span className="uc">Anchors · {anchors.length}</span>
          <h2
            className="display-i"
            style={{
              fontSize: 22,
              fontWeight: 500,
              margin: "4px 0 0",
              color: "var(--ink)",
              letterSpacing: "-0.015em",
            }}
          >
            Each place the trip has to hit.
          </h2>
        </header>

        <AddBetween onAdd={() => insertAnchorAt(0)} />

        {anchors.map((anchor, i) => (
          <div key={anchor.uid}>
            <AnchorCard
              anchor={anchor}
              first={i === 0}
              canRemove={anchors.length > 1}
              customers={customers}
              customerSites={customerSites}
              locations={locations}
              datePresets={datePresets}
              onChange={(patch) => updateAnchor(anchor.uid, patch)}
              onRemove={() => removeAnchor(anchor.uid)}
            />
            <AddBetween
              onAdd={() => insertAnchorAt(i + 1)}
              between={i < anchors.length - 1}
            />
          </div>
        ))}

        {/* Notes + title — collapsed, low-priority */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!notesOn ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setNotesOn(true)}
              style={{ alignSelf: "flex-start" }}
            >
              + Notes
            </button>
          ) : (
            <div className="brief-subcard">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span className="uc">Trip notes</span>
                <button
                  type="button"
                  onClick={() => setNotesOn(false)}
                  style={{ fontSize: 11.5, color: "var(--rust)" }}
                >
                  Remove
                </button>
              </div>
              <textarea
                className="field"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="The brief, dress code, who's expected — anything Khonsera should know."
              />
            </div>
          )}

          <details className="brief-details">
            <summary className="brief-details-summary">
              <span className="uc">Title override</span>
              <span className="brief-details-hint">
                {titleOverride
                  ? `“${titleOverride}”`
                  : "Khonsera will pick one for you"}
              </span>
            </summary>
            <input
              type="text"
              className="field"
              value={titleOverride}
              onChange={(e) => setTitleOverride(e.target.value)}
              placeholder="e.g. Belper site visit"
              style={{ marginTop: 8 }}
            />
          </details>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 6,
          }}
        >
          <button
            type="button"
            disabled={!canSubmit || pending}
            onClick={submit}
            className="btn btn-gold btn-lg"
          >
            {pending ? "Building your day…" : "Build my day"}
            <Arrow />
          </button>
          {!canSubmit ? (
            <span className="brief-helper" style={{ margin: 0 }}>
              Every anchor needs a place to continue.
            </span>
          ) : null}
        </div>
      </div>

      {/* Right — live spine preview */}
      <aside className="brief-preview" aria-label="What Khonsera will build">
        <div className="flank left">
          <span>What we&rsquo;ll build</span>
        </div>
        <BonesPreview
          anchors={anchors}
          titleOverride={titleOverride}
          timezone={timezone}
        />
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// AnchorCard — one editable anchor in the stack.
// ─────────────────────────────────────────────────────────────────────

function AnchorCard({
  anchor,
  first,
  canRemove,
  customers,
  customerSites,
  locations,
  datePresets,
  onChange,
  onRemove,
}: {
  anchor: Anchor;
  first: boolean;
  canRemove: boolean;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  datePresets: Array<{ label: string; value: string }>;
  onChange: (patch: Partial<Anchor>) => void;
  onRemove: () => void;
}) {
  const kind = effectiveKind(anchor);

  return (
    <section
      className={first ? "brief-card brief-card-hero" : "brief-card"}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <KindGlyph kind={kind} />
          <span className="uc">{kindLabel(kind)}</span>
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            style={{ fontSize: 11.5, color: "var(--rust)" }}
          >
            Remove
          </button>
        ) : null}
      </header>

      <PlacePicker
        customers={customers}
        customerSites={customerSites}
        locations={locations}
        value={anchor.place}
        onChange={(place) => {
          onChange({
            place,
            // When the user picks a fresh place, clear the manual override
            // so the inferred type takes over.
            kindOverride: null,
          });
        }}
        placeholder="Search anywhere — your places pin to the top"
      />

      {anchor.place ? (
        <KindOverrideRow
          anchor={anchor}
          inferred={inferredKind(anchor)}
          onPickKind={(k) => onChange({ kindOverride: k })}
        />
      ) : null}

      {/* Time fields — adapt to the effective kind */}
      {kind === "hotel" ? (
        <HotelTimes
          anchor={anchor}
          datePresets={datePresets}
          onChange={onChange}
        />
      ) : (
        <AppointmentTimes
          anchor={anchor}
          datePresets={datePresets}
          onChange={onChange}
          isStation={kind === "station"}
        />
      )}
    </section>
  );
}

function KindGlyph({ kind }: { kind: AnchorKind }) {
  const d =
    kind === "hotel"
      ? "M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 18h18M3 18v2M21 18v2M7 11V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"
      : kind === "station"
        ? "M5 3h14v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z M5 11h14"
        : "M3 10l4-4 3 3 3-3 4 4 M3 14l5 5 4-4 4 4 5-5";
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        background:
          kind === "hotel"
            ? "var(--gold-tint)"
            : kind === "station"
              ? "var(--slate-soft)"
              : "var(--gold-tint)",
        color:
          kind === "hotel"
            ? "var(--gold-2)"
            : kind === "station"
              ? "var(--slate-2)"
              : "var(--gold-2)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={d} />
      </svg>
    </span>
  );
}

function KindOverrideRow({
  anchor,
  inferred,
  onPickKind,
}: {
  anchor: Anchor;
  inferred: AnchorKind;
  onPickKind: (k: AnchorKind | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = effectiveKind(anchor);

  return (
    <div className="kind-override">
      <span className="kind-override-current">
        Treating as <strong>{kindLabel(current).toLowerCase()}</strong>
        {anchor.kindOverride && anchor.kindOverride !== inferred ? (
          <span className="kind-override-flag">overridden</span>
        ) : null}
      </span>
      {open ? (
        <span className="kind-override-pills">
          {(["appointment", "hotel", "station"] as AnchorKind[]).map((k) => (
            <button
              key={k}
              type="button"
              className="pill brief-pill"
              data-active={k === current}
              onClick={async () => {
                onPickKind(k === inferred ? null : k);
                setOpen(false);
                // If we have a saved location, persist the type so future
                // pickers and the editor reflect it too.
                if (anchor.place?.kind === "location") {
                  const targetType: LocationType =
                    k === "hotel"
                      ? "hotel"
                      : k === "station"
                        ? "station"
                        : "other";
                  if (anchor.place.location_type !== targetType) {
                    await updateLocationType({
                      id: anchor.place.location_id,
                      type: targetType,
                    });
                  }
                }
              }}
            >
              {kindLabel(k)}
            </button>
          ))}
        </span>
      ) : (
        <button
          type="button"
          className="kind-override-toggle"
          onClick={() => setOpen(true)}
        >
          Change
        </button>
      )}
    </div>
  );
}

function HotelTimes({
  anchor,
  datePresets,
  onChange,
}: {
  anchor: Anchor;
  datePresets: Array<{ label: string; value: string }>;
  onChange: (patch: Partial<Anchor>) => void;
}) {
  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Check-in</span>
          <input
            type="date"
            className="field"
            value={anchor.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">From</span>
          <input
            type="time"
            className="field"
            value={anchor.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Check-out</span>
          <input
            type="date"
            className="field"
            value={anchor.checkOutDate || nextDay(anchor.date)}
            onChange={(e) => onChange({ checkOutDate: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">By</span>
          <input
            type="time"
            className="field"
            value={anchor.checkOutTime || "11:00"}
            onChange={(e) => onChange({ checkOutTime: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-pill-row">
        {datePresets.map((p) => (
          <button
            key={p.value}
            type="button"
            className="pill brief-pill"
            data-active={p.value === anchor.date}
            onClick={() =>
              onChange({
                date: p.value,
                checkOutDate: nextDay(p.value),
              })
            }
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AppointmentTimes({
  anchor,
  datePresets,
  onChange,
  isStation,
}: {
  anchor: Anchor;
  datePresets: Array<{ label: string; value: string }>;
  onChange: (patch: Partial<Anchor>) => void;
  isStation: boolean;
}) {
  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Date</span>
          <input
            type="date"
            className="field"
            value={anchor.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">{isStation ? "Catch by" : "Arrive by"}</span>
          <input
            type="time"
            className="field"
            value={anchor.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-pill-row">
        {datePresets.map((p) => (
          <button
            key={p.value}
            type="button"
            className="pill brief-pill"
            data-active={p.value === anchor.date}
            onClick={() => onChange({ date: p.value })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="brief-pill-row" style={{ marginTop: 4 }}>
        {TIME_PRESETS.map((t) => (
          <button
            key={t}
            type="button"
            className="pill brief-pill"
            data-active={t === anchor.startTime}
            onClick={() => onChange({ startTime: t })}
          >
            {t}
          </button>
        ))}
      </div>
      {!isStation ? (
        <div style={{ marginTop: 4 }}>
          <span className="uc">Duration</span>
          <div className="brief-pill-row" style={{ marginTop: 6 }}>
            {APPT_DURATIONS.map((d) => (
              <button
                key={d.label}
                type="button"
                className="pill brief-pill"
                data-active={d.mins === anchor.durationMins}
                onClick={() => onChange({ durationMins: d.mins })}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// AddBetween — the +/+ slim row between anchors (and at top/bottom).
// ─────────────────────────────────────────────────────────────────────
function AddBetween({
  onAdd,
  between,
}: {
  onAdd: () => void;
  between?: boolean;
}) {
  return (
    <div
      className={between ? "brief-between brief-between-mid" : "brief-between"}
    >
      <button type="button" className="brief-between-btn" onClick={onAdd}>
        <span aria-hidden>+</span>
        <span>{between ? "Add another here" : "Add an anchor"}</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// BonesPreview — sticky right column. Renders home + each anchor as
// timeline stops; hotel rows show check-in/out window.
// ─────────────────────────────────────────────────────────────────────
function BonesPreview({
  anchors,
  titleOverride,
  timezone,
}: {
  anchors: Anchor[];
  titleOverride: string;
  timezone: string;
}) {
  const haveAny = anchors.some((a) => a.place != null);
  if (!haveAny) {
    return (
      <div className="brief-preview-empty">
        <p
          className="serif-i"
          style={{ color: "var(--ink-dim)", margin: 0, lineHeight: 1.5 }}
        >
          Pick at least one place and Khonsera will sketch the spine of the
          day here — home first, then each anchor in date order.
        </p>
      </div>
    );
  }

  // Sort anchors by date+time for the preview (matches the server).
  const sorted = [...anchors]
    .filter((a) => a.place != null)
    .sort((a, b) =>
      `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`),
    );

  const titleSource =
    sorted.find((a) => effectiveKind(a) !== "hotel") ?? sorted[0];
  const workingTitle =
    titleOverride || titleSource?.place?.label || "Untitled trip";

  return (
    <div
      className="card brief-preview-card"
      style={{ padding: 18, marginTop: 10 }}
    >
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span className="uc">Working title</span>
        <span
          className="display-i"
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "var(--ink)",
            lineHeight: 1.15,
          }}
        >
          {workingTitle}
        </span>
      </div>

      <div className="tl">
        <BonesStop
          time="—"
          eyebrow="Start"
          title="Home"
          sub="From your travel profile"
          dotKind="default"
        />
        {sorted.map((a) => {
          const kind = effectiveKind(a);
          const isLast = a === sorted[sorted.length - 1];
          if (kind === "hotel") {
            return (
              <BonesStop
                key={a.uid}
                time={fmtShortDate(a.date, timezone)}
                eyebrow="Stay"
                title={a.place?.label ?? ""}
                sub={`${a.startTime}${a.checkOutDate ? ` → ${fmtShortDate(a.checkOutDate, timezone)} ${a.checkOutTime || "11:00"}` : ""}`}
                dotKind="default"
                last={isLast}
              />
            );
          }
          return (
            <BonesStop
              key={a.uid}
              time={a.startTime}
              eyebrow={kind === "station" ? "Catch" : "Appointment"}
              title={a.place?.label ?? ""}
              sub={`${fmtShortDate(a.date, timezone)}${a.durationMins ? ` · ${fmtDur(a.durationMins)}` : ""}`}
              dotKind="gold"
              last={isLast}
            />
          );
        })}
      </div>
    </div>
  );
}

function BonesStop({
  time,
  eyebrow,
  title,
  sub,
  dotKind = "default",
  last,
}: {
  time: string;
  eyebrow: string;
  title: string;
  sub: string;
  dotKind?: "default" | "gold";
  last?: boolean;
}) {
  return (
    <>
      <div className="tl-time">{time}</div>
      <div className="tl-rail">
        <div className={dotKind === "gold" ? "tl-dot gold" : "tl-dot"} />
      </div>
      <div className="tl-content" style={{ padding: "6px 0 14px" }}>
        <p className="tl-eyebrow" style={{ marginBottom: 2 }}>
          {eyebrow}
        </p>
        <h3 className="tl-title">
          {dotKind === "gold" ? <em>{title}</em> : title}
        </h3>
        <p className="tl-sub">{sub}</p>
        {last ? null : null}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function effectiveKind(a: Anchor): AnchorKind {
  return a.kindOverride ?? inferredKind(a);
}

function inferredKind(a: Anchor): AnchorKind {
  if (!a.place) return "appointment";
  if (a.place.kind !== "location") return "appointment";
  switch (a.place.location_type) {
    case "hotel":
      return "hotel";
    case "station":
      return "station";
    default:
      return "appointment";
  }
}

function kindLabel(k: AnchorKind): string {
  switch (k) {
    case "hotel":
      return "Stay";
    case "station":
      return "Station";
    case "appointment":
    default:
      return "Appointment";
  }
}

function emptyAnchor(date: string): Anchor {
  return {
    uid: cryptoUid(),
    place: null,
    kindOverride: null,
    date,
    startTime: "09:00",
    durationMins: 60,
    checkOutDate: nextDay(date),
    checkOutTime: "11:00",
    notes: "",
  };
}

function cryptoUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `a_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function nextDay(iso: string): string {
  if (!iso) return iso;
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function defaultAnchorDate(): string {
  const now = new Date();
  const target = new Date(now);
  if (now.getHours() >= 19) {
    target.setDate(target.getDate() + 2);
  } else {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString().slice(0, 10);
}

function buildDatePresets(timezone: string) {
  const now = new Date();
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      timeZone: timezone,
    }).format(d);
  const value = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(d);

  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(today.getDate() + 1);
  const out: Array<{ label: string; value: string }> = [
    { label: "Today", value: value(today) },
    { label: "Tomorrow", value: value(tomorrow) },
  ];
  for (let i = 2; i <= 5; i++) {
    const d = new Date(now);
    d.setDate(today.getDate() + i);
    out.push({ label: fmt(d), value: value(d) });
  }
  return out;
}

function fmtShortDate(iso: string, timezone: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(new Date(`${iso}T12:00:00Z`));
}

function fmtDur(m: number): string {
  if (m >= 480) return "Full day";
  if (m >= 240) return "Half-day";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function Arrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
