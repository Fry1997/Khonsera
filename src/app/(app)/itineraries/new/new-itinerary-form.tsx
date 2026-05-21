"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition, useEffect, useRef } from "react";
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
import { TransportIcon, type TransportName } from "@/components/icons";

// ─────────────────────────────────────────────────────────────────────
// Kinds + sub-roles
//
// Each anchor in the brief carries a kind (the primary badge) and an
// optional role (the sub-badge). Both are inferred from the chosen
// place's Google type but the user can override either at any time.
// ─────────────────────────────────────────────────────────────────────

type AnchorKind = "appointment" | "stay" | "meal" | "event" | "station";
type AnchorRole = string | null;

type RoleOption = { value: string; label: string };

const ROLES: Record<AnchorKind, RoleOption[]> = {
  appointment: [],
  stay: [
    { value: "check_in", label: "Check in" },
    { value: "return_to_room", label: "Return to room" },
  ],
  meal: [
    { value: "breakfast", label: "Breakfast" },
    { value: "lunch", label: "Lunch" },
    { value: "dinner", label: "Dinner" },
    { value: "drinks", label: "Drinks" },
  ],
  event: [
    { value: "session", label: "Session" },
    { value: "show", label: "Show" },
    { value: "concert", label: "Concert" },
  ],
  station: [
    { value: "train", label: "Train" },
    { value: "flight", label: "Flight" },
    { value: "bus", label: "Bus" },
  ],
};

const KIND_OPTIONS: Array<{ value: AnchorKind; label: string }> = [
  { value: "appointment", label: "Appointment" },
  { value: "stay", label: "Stay" },
  { value: "meal", label: "Meal" },
  { value: "event", label: "Event" },
  { value: "station", label: "Station" },
];

// Timing mode — what's pinned on this anchor.
//   arrive_by   — you know when you need to be there. Most common.
//   leave_by    — you know when you need to leave (a train to catch,
//                 a dinner to make). The arrival is derived backwards.
//   around_then — you only know the duration; Khonsera fits the stop
//                 between the adjacent anchors once travel is known.
type TimingMode = "arrive_by" | "leave_by" | "around_then";

type Anchor = {
  uid: string;
  place: PlaceSelection | null;
  kindOverride: AnchorKind | null;
  roleOverride: AnchorRole | null;
  date: string;
  // The single "when" field — its meaning depends on timingMode.
  // For around_then it's ignored.
  time: string;
  timingMode: TimingMode;
  timingModeOverride: boolean;
  durationMins: number;
  // stay (check_in) only — always arrive_by semantically.
  checkOutDate: string;
  checkOutTime: string;
};

// ─────────────────────────────────────────────────────────────────────
// Transitions
//
// Each pair of adjacent anchors can carry an intended travel mode and
// optionally a pre-booked ticket. "auto" means "let the editor pick";
// any other mode locks the editor onto that. Booking, when present,
// also locks start/end times.
// ─────────────────────────────────────────────────────────────────────

type TransitionMode =
  | "auto"
  | "walk"
  | "drive"
  | "taxi"
  | "bus"
  | "tube"
  | "train"
  | "flight"
  | "mixed";

type BriefBooking = {
  provider: string;
  reference: string;
  serviceNumber: string;
  departTime: string;
  arriveTime: string;
  seat: string;
  price: string;
};

type LocalMode = "auto" | "walk" | "drive" | "taxi";

// A Stopover is an *intent* to drop in somewhere between two anchors — not
// an anchor itself. It has no fixed time, only an ideal duration; its
// position is implied by which two anchors it sits between. The leave-by
// times propagate backwards from the next anchor's fixed start.
type Stopover = {
  place: PlaceSelection | null;
  durationMins: number;
};

function emptyStopover(): Stopover {
  return { place: null, durationMins: 30 };
}

// Same preset chips the AppointmentTimes block uses, minus half/full-day —
// a stopover that lasts half a day is really a Meal or Appointment anchor.
const STOPOVER_DURATIONS = [
  { label: "15m", mins: 15 },
  { label: "30m", mins: 30 },
  { label: "1h", mins: 60 },
  { label: "2h", mins: 120 },
];

type BriefTransition = {
  mode: TransitionMode;
  // For station-/airport-based modes, the user's intent for the legs
  // at each end of the main service:
  //   localBefore — origin → departure terminal
  //   localAfter  — arrival terminal → destination
  // The two can differ (drive to your local station, walk from Euston
  // to the hotel) — that's the point of having two.
  localBefore: LocalMode;
  localAfter: LocalMode;
  booked: boolean;
  booking: BriefBooking;
};

function emptyTransition(): BriefTransition {
  return {
    mode: "auto",
    localBefore: "auto",
    localAfter: "auto",
    booked: false,
    booking: {
      provider: "",
      reference: "",
      serviceNumber: "",
      departTime: "",
      arriveTime: "",
      seat: "",
      price: "",
    },
  };
}

const TRANSITION_OPTIONS: Array<{
  value: TransitionMode;
  label: string;
  icon: TransportName;
  // True when the mode is fundamentally station-/airport-based — the
  // user has to get to and from a terminal at each end, so we ask for
  // the local connection mode.
  stationBased?: boolean;
}> = [
  { value: "auto", label: "Auto", icon: "auto" },
  { value: "walk", label: "Walk", icon: "walk" },
  { value: "drive", label: "Drive", icon: "drive" },
  { value: "train", label: "Train", icon: "train", stationBased: true },
  { value: "tube", label: "Tube", icon: "tube", stationBased: true },
  { value: "bus", label: "Bus", icon: "bus", stationBased: true },
  { value: "taxi", label: "Taxi", icon: "taxi" },
  { value: "flight", label: "Flight", icon: "flight", stationBased: true },
];

// Local connection modes — the legs at each end of a station-based
// trip ("to the station" / "from the station"). Keep "auto" so the
// user can defer to Khonsera.
const LOCAL_MODES: Array<{
  value: "auto" | "walk" | "drive" | "taxi";
  label: string;
  icon: TransportName;
}> = [
  { value: "auto", label: "Auto", icon: "auto" },
  { value: "walk", label: "Walk", icon: "walk" },
  { value: "drive", label: "Drive", icon: "drive" },
  { value: "taxi", label: "Taxi", icon: "taxi" },
];

const APPT_DURATIONS = [
  { label: "30m", mins: 30 },
  { label: "1h", mins: 60 },
  { label: "2h", mins: 120 },
  { label: "Half-day", mins: 240 },
  { label: "Full day", mins: 480 },
];

// Time presets — hourly across the working day plus a handful of common
// shoulder-time slots. The pill row scrolls horizontally on mobile so
// the full set is one swipe away; the explicit time input always wins
// for unusual values.
const TIME_PRESETS = [
  "06:00",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "21:00",
  "22:00",
];

// Sentinel client_id for the implicit "home" anchor. The server doesn't
// see this as an anchor — it's already auto-seeded from the travel
// profile — but we use it client-side to key the transition between
// home and the first user-entered anchor.
const HOME_UID = "__khonsera_home__";

export function NewItineraryBrief({
  customers,
  customerSites,
  locations,
  timezone,
  homeLabel,
}: {
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  timezone: string;
  homeLabel: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  const [anchors, setAnchors] = useState<Anchor[]>([
    emptyAnchor(defaultAnchorDate()),
  ]);
  // Transitions keyed by "fromUid::toUid" — survives anchor inserts as
  // long as that pair stays adjacent. Map keeps render simple via lookup.
  const [transitions, setTransitions] = useState<
    Map<string, BriefTransition>
  >(new Map());
  // Stopovers keyed by the same transition pair — a stopover lives on
  // the leg between two anchors, not as an anchor itself.
  const [stopovers, setStopovers] = useState<Map<string, Stopover>>(new Map());
  const [titleOverride, setTitleOverride] = useState("");
  const [notes, setNotes] = useState("");
  const [notesOn, setNotesOn] = useState(false);

  const transitionKey = (fromUid: string, toUid: string) =>
    `${fromUid}::${toUid}`;

  const getTransition = (fromUid: string, toUid: string): BriefTransition =>
    transitions.get(transitionKey(fromUid, toUid)) ?? emptyTransition();

  const setTransition = (
    fromUid: string,
    toUid: string,
    patch: Partial<BriefTransition>,
  ) => {
    setTransitions((prev) => {
      const next = new Map(prev);
      const k = transitionKey(fromUid, toUid);
      const existing = next.get(k) ?? emptyTransition();
      next.set(k, { ...existing, ...patch });
      return next;
    });
  };

  const getStopover = (fromUid: string, toUid: string): Stopover | undefined =>
    stopovers.get(transitionKey(fromUid, toUid));

  const setStopoverPatch = (
    fromUid: string,
    toUid: string,
    patch: Partial<Stopover>,
  ) => {
    setStopovers((prev) => {
      const next = new Map(prev);
      const k = transitionKey(fromUid, toUid);
      const existing = next.get(k) ?? emptyStopover();
      next.set(k, { ...existing, ...patch });
      return next;
    });
  };

  const removeStopover = (fromUid: string, toUid: string) => {
    setStopovers((prev) => {
      const next = new Map(prev);
      next.delete(transitionKey(fromUid, toUid));
      return next;
    });
  };

  const datePresets = useMemo(() => buildDatePresets(timezone), [timezone]);

  const updateAnchor = (uid: string, patch: Partial<Anchor>) => {
    setAnchors((prev) =>
      // Re-sort after every patch so a date/time edit that pushes an
      // anchor before its neighbour is reflected immediately in the
      // visual order.
      sortAnchorsByTime(
        prev.map((a) => (a.uid === uid ? { ...a, ...patch } : a)),
      ),
    );
  };

  const insertAnchorAt = (index: number) => {
    const previous =
      anchors[Math.max(0, Math.min(index - 1, anchors.length - 1))];
    const seed = emptyAnchor(previous?.date ?? defaultAnchorDate());
    setAnchors((prev) => {
      const copy = [...prev];
      copy.splice(index, 0, seed);
      return sortAnchorsByTime(copy);
    });
  };

  const removeAnchor = (uid: string) => {
    setAnchors((prev) => {
      if (prev.length <= 1) return prev;
      return sortAnchorsByTime(prev.filter((a) => a.uid !== uid));
    });
  };

  // ── Stay-revisit detection ─────────────────────────────────────────
  // For each anchor with a stay-typed place that ISN'T the user's own
  // override-stay, check whether an EARLIER stay anchor in the brief has
  // the same place and the new anchor falls within its check-in/out
  // window. If so, default the role to "return_to_room".
  useEffect(() => {
    let dirty = false;
    const next = anchors.map((a, i) => {
      if (effectiveKind(a) !== "stay") return a;
      // Skip if user already overrode the role.
      if (a.roleOverride != null) return a;

      const earlierStay = anchors
        .slice(0, i)
        .find(
          (other) =>
            other.place &&
            a.place &&
            samePlace(other.place, a.place) &&
            effectiveKind(other) === "stay" &&
            (other.roleOverride ?? "check_in") === "check_in" &&
            anchorWithinStay(a, other),
        );

      const desiredRole = earlierStay ? "return_to_room" : "check_in";
      const currentRole =
        a.roleOverride ?? inferredRoleFor(a, anchors.slice(0, i));
      if (currentRole !== desiredRole) {
        dirty = true;
        return { ...a, roleOverride: null };
      }
      return a;
    });
    if (dirty) setAnchors(sortAnchorsByTime(next));
    // anchors is intentionally the only dep; we want this to re-evaluate
    // every time the user edits a place / date / time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchors]);

  const canSubmit = anchors.every((a) => a.place != null);

  const submit = () => {
    setFeedback(null);

    if (!canSubmit) {
      setFeedback({
        message:
          "Pick a place for every anchor — that's the bit Khonsera plans around.",
        fieldErrors: { anchors: "required" },
      });
      return;
    }

    startTransition(async () => {
      const result = await createItineraryFromBrief({
        anchors: anchors.map((a, i) => {
          const kind = effectiveKind(a);
          const role = effectiveRole(a, anchors.slice(0, i));
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
          const isCheckIn = kind === "stay" && role !== "return_to_room";
          const mode = effectiveTimingMode(a);
          const base = {
            client_id: a.uid,
            kind,
            role,
            date: a.date,
            // Stay/check-in is always arrive_by — the "Check-in from" time.
            timing_mode: isCheckIn ? ("arrive_by" as const) : mode,
            time:
              mode === "around_then" && !isCheckIn ? null : a.time,
            notes: null,
            ...placeArgs,
          };
          if (isCheckIn) {
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
        // Only send transitions the user actually touched — pairs left
        // on the default "auto, no booking" silently skip the server's
        // transitions block and let the editor solver compute them.
        transitions: (() => {
          // Build the transition payload as: optional home → anchors[0],
          // then each (anchors[i] → anchors[i+1]) pair. Pairs left on
          // "auto, no booking" are dropped — the editor solver computes
          // those from scratch.
          const out: Array<{
            from_client_id: string;
            to_client_id: string;
            mode: TransitionMode;
            local_before?: LocalMode | null;
            local_after?: LocalMode | null;
            booking:
              | {
                  provider: string | null;
                  reference: string | null;
                  service_number: string | null;
                  depart_time: string;
                  arrive_time: string;
                  seat: string | null;
                  price: number | null;
                  currency: "GBP";
                }
              | null;
          }> = [];

          const serialize = (
            fromUid: string,
            toUid: string,
            t: BriefTransition,
          ) => {
            const meaningful = t.mode !== "auto" || t.booked;
            if (!meaningful) return;
            const booking =
              t.booked &&
              t.booking.departTime &&
              t.booking.arriveTime
                ? {
                    provider: t.booking.provider || null,
                    reference: t.booking.reference || null,
                    service_number: t.booking.serviceNumber || null,
                    depart_time: t.booking.departTime,
                    arrive_time: t.booking.arriveTime,
                    seat: t.booking.seat || null,
                    price: t.booking.price ? Number(t.booking.price) : null,
                    currency: "GBP" as const,
                  }
                : null;
            out.push({
              from_client_id: fromUid,
              to_client_id: toUid,
              mode: t.mode,
              local_before: t.localBefore,
              local_after: t.localAfter,
              booking,
            });
          };

          // Implicit home leg first.
          if (anchors[0]) {
            const homeT = getTransition(HOME_UID, anchors[0].uid);
            serialize(HOME_UID, anchors[0].uid, homeT);
          }
          // Then each adjacent pair.
          for (let i = 0; i < anchors.length - 1; i++) {
            const a = anchors[i];
            const next = anchors[i + 1];
            serialize(a.uid, next.uid, getTransition(a.uid, next.uid));
          }
          return out;
        })(),
        // Stopovers — one row per (fromUid, toUid) intent. Skip any that
        // are still placeholder-empty (no place picked) so the server
        // doesn't persist meaningless rows.
        stopovers: (() => {
          const out: Array<{
            from_client_id: string;
            to_client_id: string;
            location_id?: string | null;
            customer_id?: string | null;
            customer_site_id?: string | null;
            label?: string | null;
            duration_minutes: number;
          }> = [];
          for (const [key, sv] of stopovers.entries()) {
            const [fromUid, toUid] = key.split("::");
            // A stopover with no place set isn't worth sending — the
            // user opened the card but never filled it in.
            if (!sv.place) continue;
            const placeArgs =
              sv.place.kind === "location"
                ? { location_id: sv.place.location_id, label: sv.place.label }
                : sv.place.kind === "customer_site"
                  ? {
                      customer_site_id: sv.place.customer_site_id,
                      customer_id: sv.place.customer_id,
                      label: sv.place.label,
                    }
                  : { customer_id: sv.place.customer_id, label: sv.place.label };
            out.push({
              from_client_id: fromUid,
              to_client_id: toUid,
              ...placeArgs,
              duration_minutes: sv.durationMins,
            });
          }
          return out;
        })(),
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

        {anchors.map((anchor, i) => {
          const next = anchors[i + 1];
          // For the first anchor with a place picked, surface the
          // implicit "from home" transition above the card so the user
          // can pick a mode (or add a booked ticket) for the leg
          // before the brief even starts.
          const showHomeVia = i === 0 && anchor.place != null;
          return (
            <div key={anchor.uid}>
              {showHomeVia ? (
                <TransitionRow
                  from={null}
                  to={anchor}
                  transition={getTransition(HOME_UID, anchor.uid)}
                  onChange={(patch) =>
                    setTransition(HOME_UID, anchor.uid, patch)
                  }
                  fromVirtualLabel={homeLabel ?? "Home"}
                />
              ) : null}
              <AnchorCard
                anchor={anchor}
                earlier={anchors.slice(0, i)}
                first={i === 0}
                canRemove={anchors.length > 1}
                customers={customers}
                customerSites={customerSites}
                locations={locations}
                datePresets={datePresets}
                onChange={(patch) => updateAnchor(anchor.uid, patch)}
                onRemove={() => removeAnchor(anchor.uid)}
              />
              {next ? (
                <>
                  <TransitionRow
                    from={anchor}
                    to={next}
                    transition={getTransition(anchor.uid, next.uid)}
                    stopoverPresent={!!getStopover(anchor.uid, next.uid)}
                    onAddStopover={() =>
                      setStopoverPatch(anchor.uid, next.uid, {})
                    }
                    onChange={(patch) =>
                      setTransition(anchor.uid, next.uid, patch)
                    }
                  />
                  {(() => {
                    const sv = getStopover(anchor.uid, next.uid);
                    if (!sv) return null;
                    return (
                      <StopoverCard
                        stopover={sv}
                        fromAnchor={anchor}
                        toAnchor={next}
                        customers={customers}
                        customerSites={customerSites}
                        locations={locations}
                        onChange={(patch) =>
                          setStopoverPatch(anchor.uid, next.uid, patch)
                        }
                        onRemove={() => removeStopover(anchor.uid, next.uid)}
                      />
                    );
                  })()}
                </>
              ) : null}
              <AddBetween
                onAdd={() => insertAnchorAt(i + 1)}
                between={i < anchors.length - 1}
              />
            </div>
          );
        })}

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
          transitions={transitions}
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
  earlier,
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
  earlier: Anchor[];
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
  const role = effectiveRole(anchor, earlier);
  const isStayCheckIn = kind === "stay" && role !== "return_to_room";
  const isStayReturn = kind === "stay" && role === "return_to_room";

  return (
    <section className={first ? "brief-card brief-card-hero" : "brief-card"}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <KindBadge kind={kind} role={role} anchor={anchor} earlier={earlier} onChange={onChange} />
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
            // Clear both overrides so inference can re-run from the new
            // place's type.
            kindOverride: null,
            roleOverride: null,
          });
        }}
        defaultNewType={
          kind === "stay" ? "hotel" : kind === "station" ? "station" : "other"
        }
        placeholder="Search anywhere — your places pin to the top"
      />

      {/* Time fields — adapt to the effective kind + role */}
      {isStayCheckIn ? (
        <HotelTimes
          anchor={anchor}
          datePresets={datePresets}
          onChange={onChange}
        />
      ) : isStayReturn ? (
        <ReturnToRoom anchor={anchor} onChange={onChange} earlier={earlier} />
      ) : (
        <AppointmentTimes
          anchor={anchor}
          datePresets={datePresets}
          onChange={onChange}
          kind={kind}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// KindBadge — the primary "Stay / Appointment / Meal …" badge plus its
// sub-role badge. Both pop a small picker on click. The "overridden"
// flag appears when the user has manually re-classified.
// ─────────────────────────────────────────────────────────────────────

function KindBadge({
  kind,
  role,
  anchor,
  earlier,
  onChange,
}: {
  kind: AnchorKind;
  role: AnchorRole;
  anchor: Anchor;
  earlier: Anchor[];
  onChange: (patch: Partial<Anchor>) => void;
}) {
  const [openKind, setOpenKind] = useState(false);
  const [openRole, setOpenRole] = useState(false);
  const kindRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (openKind && !kindRef.current?.contains(e.target as Node))
        setOpenKind(false);
      if (openRole && !roleRef.current?.contains(e.target as Node))
        setOpenRole(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openKind, openRole]);

  const inferredK = inferredKind(anchor);
  const inferredR = inferredRoleFor(anchor, earlier);
  const kindLabel = labelForKind(kind);
  const roleLabel = role ? labelForRole(kind, role) : null;

  const persistKindOverride = async (k: AnchorKind | null) => {
    onChange({
      kindOverride: k === inferredK ? null : k,
      // Reset role + timing-mode overrides when kind changes — both
      // re-infer from the new kind.
      roleOverride: null,
      timingModeOverride: false,
    });
    setOpenKind(false);
    // Persist type back to the saved location when applicable.
    if (anchor.place?.kind === "location" && k != null) {
      const targetType: LocationType =
        k === "stay"
          ? "hotel"
          : k === "station"
            ? "station"
            : k === "meal"
              ? "other"
              : k === "event"
                ? "other"
                : "other";
      if (anchor.place.location_type !== targetType) {
        await updateLocationType({
          id: anchor.place.location_id,
          type: targetType,
        });
      }
    }
  };

  const persistRoleOverride = (r: string | null) => {
    onChange({
      roleOverride: r === inferredR ? null : r,
      // Role swap (e.g. check_in → return_to_room) wants a fresh timing
      // inference too, unless the user has explicitly set one already.
      timingModeOverride: false,
    });
    setOpenRole(false);
  };

  const kindOverridden = anchor.kindOverride != null && anchor.kindOverride !== inferredK;
  const roleOverridden = anchor.roleOverride != null && anchor.roleOverride !== inferredR;

  return (
    <>
      <div ref={kindRef} style={{ position: "relative" }}>
        <button
          type="button"
          className={`kind-badge kind-badge-${kind}`}
          onClick={() => setOpenKind((v) => !v)}
        >
          <KindDot kind={kind} />
          <span>{kindLabel}</span>
          {kindOverridden ? (
            <span className="kind-badge-flag">overridden</span>
          ) : null}
          <ChevDown />
        </button>
        {openKind ? (
          <div className="kind-pop">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="kind-pop-item"
                data-active={opt.value === kind}
                onClick={() => void persistKindOverride(opt.value)}
              >
                <KindDot kind={opt.value} />
                <span>{opt.label}</span>
                {opt.value === inferredK ? (
                  <span className="kind-pop-hint">suggested</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {ROLES[kind].length > 0 && roleLabel ? (
        <div ref={roleRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="kind-subbadge"
            onClick={() => setOpenRole((v) => !v)}
          >
            <span>{roleLabel}</span>
            {roleOverridden ? (
              <span className="kind-badge-flag">overridden</span>
            ) : null}
            <ChevDown />
          </button>
          {openRole ? (
            <div className="kind-pop">
              {ROLES[kind].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="kind-pop-item"
                  data-active={opt.value === role}
                  onClick={() => persistRoleOverride(opt.value)}
                >
                  <span>{opt.label}</span>
                  {opt.value === inferredR ? (
                    <span className="kind-pop-hint">suggested</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function KindDot({ kind }: { kind: AnchorKind }) {
  // Each kind gets its own tint so the badge reads in a glance.
  const tint =
    kind === "stay"
      ? "var(--gold)"
      : kind === "meal"
        ? "var(--terra)"
        : kind === "event"
          ? "var(--plum)"
          : kind === "station"
            ? "var(--slate)"
            : "var(--ink-2)";
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: tint,
        flexShrink: 0,
      }}
    />
  );
}

function ChevDown() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ opacity: 0.5, marginLeft: 2 }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
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
  const effectiveCheckOut = anchor.checkOutDate || nextDay(anchor.date);
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
            value={anchor.time}
            onChange={(e) => onChange({ time: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-pill-row">
        {datePresets.map((p) => (
          <button
            key={`in-${p.value}`}
            type="button"
            className="pill brief-pill"
            data-active={p.value === anchor.date}
            onClick={() => {
              // Picking a new check-in shifts the check-out only if the
              // existing one no longer makes sense (empty, or now before
              // the new check-in). Otherwise we preserve the user's
              // explicit check-out choice.
              const currentOut = anchor.checkOutDate;
              const needsBump = !currentOut || currentOut <= p.value;
              onChange({
                date: p.value,
                ...(needsBump ? { checkOutDate: nextDay(p.value) } : {}),
              });
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Check-out</span>
          <input
            type="date"
            className="field"
            value={effectiveCheckOut}
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
            key={`out-${p.value}`}
            type="button"
            className="pill brief-pill"
            data-active={p.value === effectiveCheckOut}
            // A check-out before (or on) check-in is nonsense — disable.
            disabled={!!anchor.date && p.value <= anchor.date}
            onClick={() => onChange({ checkOutDate: p.value })}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReturnToRoom({
  anchor,
  earlier,
  onChange,
}: {
  anchor: Anchor;
  earlier: Anchor[];
  onChange: (patch: Partial<Anchor>) => void;
}) {
  const stay = earlier.find(
    (a) =>
      a.place && anchor.place && samePlace(a.place, anchor.place) &&
      effectiveKind(a) === "stay" &&
      (a.roleOverride ?? "check_in") === "check_in",
  );
  const mode = effectiveTimingMode(anchor);
  const setMode = (next: TimingMode) =>
    onChange({ timingMode: next, timingModeOverride: true });

  const timeLabel =
    mode === "leave_by" ? "Leave by" : "Arrive by";

  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        className="brief-subcard"
        style={{
          background: "var(--gold-tint)",
          borderColor: "var(--gold)",
          color: "var(--ink-2)",
        }}
      >
        <p
          className="serif-i"
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--ink-2)",
            lineHeight: 1.5,
          }}
        >
          {mode === "around_then" ? (
            <>
              Back at your hotel for a short while — Khonsera will fit it
              between the stops on either side
              {stay?.checkOutDate
                ? `, before check-out by ${stay.checkOutTime || "11:00"} on ${fmtShortDate(stay.checkOutDate, "UTC")}`
                : ""}
              .
            </>
          ) : (
            <>
              Using your existing stay — no new check-in needed.
            </>
          )}
        </p>
      </div>

      <TimingModeRow mode={mode} onChange={setMode} />

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
        {mode !== "around_then" ? (
          <label className="brief-field">
            <span className="uc">{timeLabel}</span>
            <input
              type="time"
              className="field"
              value={anchor.time}
              onChange={(e) => onChange({ time: e.target.value })}
            />
          </label>
        ) : (
          <div className="brief-field">
            <span className="uc">When</span>
            <div className="around-then-blurb">
              <span
                aria-hidden
                style={{ display: "inline-flex", color: "var(--gold-2)" }}
              >
                <TransportIcon.auto size={16} />
              </span>
              <span>Khonsera fits between adjacent anchors</span>
            </div>
          </div>
        )}
      </div>

      <DurationRow
        label={mode === "around_then" ? "About" : "Duration"}
        presets={[
          { label: "15m", mins: 15 },
          { label: "30m", mins: 30 },
          { label: "1h", mins: 60 },
          { label: "2h", mins: 120 },
        ]}
        value={anchor.durationMins}
        onChange={(m) => onChange({ durationMins: m })}
      />
    </div>
  );
}

function AppointmentTimes({
  anchor,
  datePresets,
  onChange,
  kind,
}: {
  anchor: Anchor;
  datePresets: Array<{ label: string; value: string }>;
  onChange: (patch: Partial<Anchor>) => void;
  kind: AnchorKind;
}) {
  const mode = effectiveTimingMode(anchor);
  const isStation = kind === "station";

  const timeLabel =
    mode === "leave_by"
      ? isStation
        ? "Catch by"
        : "Leave by"
      : "Arrive by";

  const setMode = (next: TimingMode) =>
    onChange({ timingMode: next, timingModeOverride: true });

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Timing mode picker — three pinning options. */}
      <TimingModeRow mode={mode} onChange={setMode} />

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
        {mode !== "around_then" ? (
          <label className="brief-field">
            <span className="uc">{timeLabel}</span>
            <input
              type="time"
              className="field"
              value={anchor.time}
              onChange={(e) => onChange({ time: e.target.value })}
            />
          </label>
        ) : (
          <div className="brief-field">
            <span className="uc">When</span>
            <div className="around-then-blurb">
              <span
                aria-hidden
                style={{ display: "inline-flex", color: "var(--gold-2)" }}
              >
                <TransportIcon.auto size={16} />
              </span>
              <span>Khonsera fits between adjacent anchors</span>
            </div>
          </div>
        )}
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

      {mode !== "around_then" ? (
        <div className="brief-pill-row" style={{ marginTop: 4 }}>
          {TIME_PRESETS.map((t) => (
            <button
              key={t}
              type="button"
              className="pill brief-pill"
              data-active={t === anchor.time}
              onClick={() => onChange({ time: t })}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {!isStation ? (
        <div style={{ marginTop: 4 }}>
          <DurationRow
            label={mode === "around_then" ? "About" : "Duration"}
            presets={APPT_DURATIONS}
            value={anchor.durationMins}
            onChange={(m) => onChange({ durationMins: m })}
          />
        </div>
      ) : null}
    </div>
  );
}

// DurationRow — chips + an explicit "mins" input so the user can drop a
// custom value when none of the presets fit. The input always shows the
// current value; typing replaces it. Reused by appointment + return-to-
// room blocks.
function DurationRow({
  presets,
  value,
  onChange,
  label = "Duration",
}: {
  presets: Array<{ label: string; mins: number }>;
  value: number;
  onChange: (mins: number) => void;
  label?: string;
}) {
  const matched = presets.some((p) => p.mins === value);
  return (
    <div>
      <span className="uc">{label}</span>
      <div className="brief-pill-row" style={{ marginTop: 6 }}>
        {presets.map((d) => (
          <button
            key={d.label}
            type="button"
            className="pill brief-pill"
            data-active={d.mins === value}
            onClick={() => onChange(d.mins)}
          >
            {d.label}
          </button>
        ))}
        <span
          className="duration-custom"
          data-active={!matched}
          title="Type any number of minutes"
        >
          <input
            type="number"
            min={5}
            max={24 * 60}
            step={5}
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v >= 0) onChange(v);
            }}
            aria-label="Custom duration in minutes"
          />
          <span aria-hidden>min</span>
        </span>
      </div>
    </div>
  );
}

// Timing-mode segmented control — Arrive by / Leave by / Around then.
function TimingModeRow({
  mode,
  onChange,
}: {
  mode: TimingMode;
  onChange: (next: TimingMode) => void;
}) {
  const options: Array<{
    value: TimingMode;
    label: string;
    helper: string;
  }> = [
    { value: "arrive_by", label: "Arrive by", helper: "I know when to be there" },
    { value: "leave_by", label: "Leave by", helper: "I know when I need to leave" },
    { value: "around_then", label: "Around then", helper: "Fit between things" },
  ];
  return (
    <div className="timing-mode-row">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="timing-mode-btn"
          data-active={o.value === mode}
          onClick={() => onChange(o.value)}
          title={o.helper}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TransitionRow — the slim "via X" element between two anchors. Click
// the mode chip to switch mode; "Pre-booked" toggle expands a small
// one-segment ticket form.
// ─────────────────────────────────────────────────────────────────────
function TransitionRow({
  from,
  to,
  transition,
  onChange,
  // Optional label for the from-anchor when it isn't a real anchor —
  // e.g. the implicit "home" leg before the first anchor.
  fromVirtualLabel,
  // Stopovers are an opt-in concept attached to the transition between
  // two real anchors. The row exposes an "add stop" action when no
  // stopover exists yet, and hides it once one has been added.
  stopoverPresent,
  onAddStopover,
}: {
  from: Anchor | null;
  to: Anchor;
  transition: BriefTransition;
  onChange: (patch: Partial<BriefTransition>) => void;
  fromVirtualLabel?: string;
  stopoverPresent?: boolean;
  onAddStopover?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const opt = TRANSITION_OPTIONS.find((o) => o.value === transition.mode);
  const Icon = opt ? TransportIcon[opt.icon] : TransportIcon.auto;
  const isAuto = transition.mode === "auto" && !transition.booked;
  const stationBased = opt?.stationBased ?? false;
  const beforeOpt = LOCAL_MODES.find(
    (m) => m.value === transition.localBefore,
  );
  const afterOpt = LOCAL_MODES.find(
    (m) => m.value === transition.localAfter,
  );
  const BeforeIcon = beforeOpt
    ? TransportIcon[beforeOpt.icon]
    : TransportIcon.auto;
  const AfterIcon = afterOpt
    ? TransportIcon[afterOpt.icon]
    : TransportIcon.auto;
  const symmetric = transition.localBefore === transition.localAfter;
  const showLocalHint =
    stationBased &&
    !isAuto &&
    (transition.localBefore !== "auto" || transition.localAfter !== "auto");

  return (
    <div ref={ref} className="transition-row">
      <div className="transition-line" aria-hidden />
      <button
        type="button"
        className={
          isAuto ? "transition-chip transition-chip-auto" : "transition-chip"
        }
        onClick={() => setOpen((v) => !v)}
        data-active={open}
        title={
          fromVirtualLabel
            ? `Travel from ${fromVirtualLabel}`
            : "Set the travel mode or add a booked ticket"
        }
      >
        <Icon size={14} />
        <span>
          {transition.booked
            ? `${opt?.label ?? "Booked"} · ${
                transition.booking.serviceNumber || "ticket"
              }`
            : isAuto
              ? "Khonsera picks the mode"
              : `via ${opt?.label}`}
        </span>
        {showLocalHint ? (
          <span className="transition-local-hint">
            <BeforeIcon size={11} />
            {symmetric ? (
              <span>{beforeOpt?.label.toLowerCase()}</span>
            ) : (
              <>
                <span aria-hidden style={{ opacity: 0.55 }}>›</span>
                <AfterIcon size={11} />
              </>
            )}
          </span>
        ) : null}
        {transition.booked ? (
          <span className="pill pill-gold transition-booked-badge">
            <span className="dot" />
            booked
          </span>
        ) : null}
      </button>
      <div className="transition-line" aria-hidden />

      {open ? (
        <div className="transition-pop">
          {fromVirtualLabel ? (
            <p
              className="serif-i"
              style={{
                margin: 0,
                fontSize: 13.5,
                color: "var(--ink-dim)",
                lineHeight: 1.4,
              }}
            >
              From <em style={{ color: "var(--gold-2)" }}>{fromVirtualLabel}</em>{" "}
              to the first anchor.
            </p>
          ) : null}

          <div className="transition-pop-section">
            <span className="uc">Mode</span>
            <div
              className="brief-pill-row"
              style={{ marginTop: 6, marginBottom: 4 }}
            >
              {TRANSITION_OPTIONS.map((o) => {
                const OIcon = TransportIcon[o.icon];
                return (
                  <button
                    key={o.value}
                    type="button"
                    className="pill brief-pill"
                    data-active={o.value === transition.mode}
                    onClick={() => onChange({ mode: o.value })}
                    title={
                      o.value === "auto"
                        ? "Let Khonsera pick once it knows distance"
                        : `Travel by ${o.label.toLowerCase()}`
                    }
                  >
                    <OIcon size={13} />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {stationBased ? (
            <div className="transition-pop-section">
              <span className="uc">Local connections</span>
              <p
                className="brief-helper"
                style={{ margin: "4px 0 8px", fontSize: 12 }}
              >
                Two legs — to the {opt?.label.toLowerCase()} and from it.
                Pick them separately if you'll drive to your local station
                but walk from the other end.
              </p>

              <div className="local-leg-grid">
                <LocalLegPicker
                  label={`To the ${opt?.label.toLowerCase() ?? "station"}`}
                  helper={
                    fromVirtualLabel
                      ? `From ${fromVirtualLabel}`
                      : from?.place?.label
                        ? `From ${from.place.label}`
                        : "From the previous stop"
                  }
                  value={transition.localBefore}
                  onPick={(v) => onChange({ localBefore: v })}
                />
                <LocalLegPicker
                  label={`From the ${opt?.label.toLowerCase() ?? "station"}`}
                  helper={
                    to.place?.label
                      ? `To ${to.place.label}`
                      : "To the next stop"
                  }
                  value={transition.localAfter}
                  onPick={(v) => onChange({ localAfter: v })}
                />
              </div>

              {transition.localBefore !== transition.localAfter &&
              (transition.localBefore !== "auto" ||
                transition.localAfter !== "auto") ? (
                <p
                  className="brief-helper"
                  style={{
                    margin: "8px 0 0",
                    fontSize: 11.5,
                    color: "var(--gold-2)",
                  }}
                >
                  Asymmetric — Khonsera will plan each leg independently.
                </p>
              ) : null}
            </div>
          ) : null}

          {onAddStopover && !stopoverPresent && from ? (
            <button
              type="button"
              className="transition-add-stopover"
              onClick={() => {
                onAddStopover();
                setOpen(false);
              }}
            >
              + Add a stop on the way
            </button>
          ) : null}

          <label className="transition-booked-toggle">
            <input
              type="checkbox"
              checked={transition.booked}
              onChange={(e) =>
                onChange({
                  booked: e.target.checked,
                  // Default ticket mode to non-auto when toggling on.
                  ...(e.target.checked && transition.mode === "auto"
                    ? { mode: "train" as TransitionMode }
                    : {}),
                })
              }
            />
            <span>This is already booked</span>
            <span className="brief-helper" style={{ margin: 0, fontSize: 12 }}>
              Adds the ticket to Bookings and locks the editor onto these times.
            </span>
          </label>

          {transition.booked ? (
            <BookedFields
              fromAnchor={from}
              toAnchor={to}
              booking={transition.booking}
              onChange={(patch) =>
                onChange({
                  booking: { ...transition.booking, ...patch },
                })
              }
            />
          ) : null}

          <div className="transition-pop-foot">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
            {transition.mode !== "auto" || transition.booked ? (
              <button
                type="button"
                className="transition-pop-clear"
                onClick={() => {
                  onChange({
                    mode: "auto",
                    localBefore: "auto",
                    localAfter: "auto",
                    booked: false,
                  });
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LocalLegPicker({
  label,
  helper,
  value,
  onPick,
}: {
  label: string;
  helper: string;
  value: LocalMode;
  onPick: (v: LocalMode) => void;
}) {
  return (
    <div className="local-leg">
      <div className="local-leg-head">
        <span className="uc">{label}</span>
        <span className="local-leg-helper">{helper}</span>
      </div>
      <div className="brief-pill-row">
        {LOCAL_MODES.map((m) => {
          const MIcon = TransportIcon[m.icon];
          return (
            <button
              key={m.value}
              type="button"
              className="pill brief-pill"
              data-active={m.value === value}
              onClick={() => onPick(m.value)}
            >
              <MIcon size={12} />
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// StopoverCard — an *intent* card for a place you want to fit between
// two anchors. Visually indented + dashed border so it reads as a
// secondary item that depends on its neighbours, not a hard-pinned
// anchor of its own.
//
// The actual "leave by" / "available duration" back-calculation needs
// travel-time data from the Routes API plus debouncing/caching — that
// is a follow-up. For now the card scaffolds the data model + UI and
// shows the user a helper line describing what Khonsera will do.
function StopoverCard({
  stopover,
  fromAnchor,
  toAnchor,
  customers,
  customerSites,
  locations,
  onChange,
  onRemove,
}: {
  stopover: Stopover;
  fromAnchor: Anchor;
  toAnchor: Anchor;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  onChange: (patch: Partial<Stopover>) => void;
  onRemove: () => void;
}) {
  const fromLabel = fromAnchor.place?.label ?? "the previous stop";
  const toLabel = toAnchor.place?.label ?? "the next anchor";
  return (
    <div className="stopover-card">
      <header className="stopover-card-head">
        <div className="stopover-card-eyebrow">
          <span className="uc">Stopover</span>
          <span className="stopover-card-helper">
            Fits between {fromLabel} and {toLabel}.
          </span>
        </div>
        <button
          type="button"
          className="stopover-card-remove"
          onClick={onRemove}
          aria-label="Remove stopover"
        >
          Remove
        </button>
      </header>

      <PlacePicker
        customers={customers}
        customerSites={customerSites}
        locations={locations}
        value={stopover.place}
        onChange={(place) => onChange({ place })}
        placeholder="Where do you want to drop in?"
      />

      <DurationRow
        label="Ideal duration"
        presets={STOPOVER_DURATIONS}
        value={stopover.durationMins}
        onChange={(mins) => onChange({ durationMins: mins })}
      />

      <p className="stopover-followup">
        Khonsera will work out the latest you can leave {fromLabel} and
        leave here so you still hit {toLabel} on time — travel-time math
        coming next.
      </p>
    </div>
  );
}

function BookedFields({
  fromAnchor,
  toAnchor,
  booking,
  onChange,
}: {
  fromAnchor: Anchor | null;
  toAnchor: Anchor;
  booking: BriefBooking;
  onChange: (patch: Partial<BriefBooking>) => void;
}) {
  // Sensible defaults so the user only types what they actually know.
  const departDefault =
    fromAnchor && fromAnchor.timingMode === "leave_by"
      ? fromAnchor.time
      : "";
  const arriveDefault =
    toAnchor.timingMode === "arrive_by" ? toAnchor.time : "";

  return (
    <div className="transition-booked-fields">
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Depart</span>
          <input
            type="time"
            className="field"
            value={booking.departTime || departDefault}
            onChange={(e) => onChange({ departTime: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Arrive</span>
          <input
            type="time"
            className="field"
            value={booking.arriveTime || arriveDefault}
            onChange={(e) => onChange({ arriveTime: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Service no.</span>
          <input
            type="text"
            className="field"
            placeholder="9M14 / BA245 / Bus 24"
            value={booking.serviceNumber}
            onChange={(e) => onChange({ serviceNumber: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Booking ref.</span>
          <input
            type="text"
            className="field"
            placeholder="ABC123"
            value={booking.reference}
            onChange={(e) => onChange({ reference: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Seat / row</span>
          <input
            type="text"
            className="field"
            placeholder="Coach E, Seat 32"
            value={booking.seat}
            onChange={(e) => onChange({ seat: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Price (£)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="field"
            placeholder="148.50"
            value={booking.price}
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// AddBetween — the slim + row between anchors (and at top/bottom).
// ─────────────────────────────────────────────────────────────────────
function AddBetween({
  onAdd,
  between,
}: {
  onAdd: () => void;
  between?: boolean;
}) {
  return (
    <div className={between ? "brief-between brief-between-mid" : "brief-between"}>
      <button type="button" className="brief-between-btn" onClick={onAdd}>
        <span aria-hidden>+</span>
        <span>{between ? "Add another here" : "Add an anchor"}</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// BonesPreview — sticky right column.
// ─────────────────────────────────────────────────────────────────────
function BonesPreview({
  anchors,
  transitions,
  titleOverride,
  timezone,
}: {
  anchors: Anchor[];
  transitions: Map<string, BriefTransition>;
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

  const sorted = [...anchors]
    .filter((a) => a.place != null)
    .sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
    );

  const titleSource =
    sorted.find((a) => effectiveKind(a) !== "stay") ?? sorted[0];
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
        {sorted.map((a, i) => {
          const earlier = sorted.slice(0, i);
          const prev = sorted[i - 1];
          // Surface a "via …" row when the user has expressed travel
          // intent for the prev→this adjacent pair (in entry order it
          // doesn't matter — the transitions Map is keyed by uid pair).
          const via = prev
            ? transitions.get(`${prev.uid}::${a.uid}`)
            : undefined;
          const viaRow =
            via && (via.mode !== "auto" || via.booked) ? (
              <BonesVia key={`via-${prev?.uid}-${a.uid}`} transition={via} />
            ) : null;

          const kind = effectiveKind(a);
          const role = effectiveRole(a, earlier);
          const labelForBadge = role ? labelForRole(kind, role) : labelForKind(kind);
          const isCheckIn = kind === "stay" && role !== "return_to_room";
          if (isCheckIn) {
            return (
              <Fragment key={a.uid}>
                {viaRow}
                <BonesStop
                  time={fmtShortDate(a.date, timezone)}
                  eyebrow={labelForBadge}
                  title={a.place?.label ?? ""}
                  sub={`${a.time}${
                    a.checkOutDate
                      ? ` → ${fmtShortDate(a.checkOutDate, timezone)} ${
                          a.checkOutTime || "11:00"
                        }`
                      : ""
                  }`}
                  dotKind="default"
                />
              </Fragment>
            );
          }
          const mode = effectiveTimingMode(a);
          // Time slot in the preview reflects the timing mode: arrive_by
          // shows the time, leave_by shows "by HH:MM" so the reader sees
          // the ceiling, around_then shows an em-dash (unknown — the
          // editor solver will fill it in from adjacent anchors).
          const timeSlot =
            mode === "around_then"
              ? "—"
              : mode === "leave_by"
                ? `by ${a.time}`
                : a.time;
          const subBit = a.durationMins
            ? `${fmtShortDate(a.date, timezone)} · ${mode === "around_then" ? "~" : ""}${fmtDur(a.durationMins)}`
            : fmtShortDate(a.date, timezone);
          return (
            <Fragment key={a.uid}>
              {viaRow}
              <BonesStop
                time={timeSlot}
                eyebrow={labelForBadge}
                title={
                  kind === "stay"
                    ? `Back at ${a.place?.label ?? "the hotel"}`
                    : a.place?.label ?? ""
                }
                sub={subBit}
                dotKind={kind === "stay" ? "default" : "gold"}
              />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function BonesVia({ transition }: { transition: BriefTransition }) {
  const opt = TRANSITION_OPTIONS.find((o) => o.value === transition.mode);
  const Icon = opt ? TransportIcon[opt.icon] : TransportIcon.auto;
  const label = opt?.label ?? "via";
  const sub = transition.booked
    ? `${transition.booking.serviceNumber || "ticket"}${
        transition.booking.departTime && transition.booking.arriveTime
          ? ` · ${transition.booking.departTime} → ${transition.booking.arriveTime}`
          : ""
      }`
    : "intent — Khonsera fills in distance + time";
  return (
    <>
      <div className="tl-time" />
      <div className="tl-rail">
        <div className="bones-via-tick" aria-hidden>
          <Icon size={11} />
        </div>
      </div>
      <div className="tl-content" style={{ padding: "2px 0 8px" }}>
        <p className="tl-eyebrow" style={{ marginBottom: 2 }}>
          via {label}
          {transition.booked ? " · booked" : ""}
        </p>
        <p className="tl-sub" style={{ marginTop: 0 }}>
          {sub}
        </p>
      </div>
    </>
  );
}

function BonesStop({
  time,
  eyebrow,
  title,
  sub,
  dotKind = "default",
}: {
  time: string;
  eyebrow: string;
  title: string;
  sub: string;
  dotKind?: "default" | "gold";
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
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Inference / helpers
// ─────────────────────────────────────────────────────────────────────

function effectiveKind(a: Anchor): AnchorKind {
  return a.kindOverride ?? inferredKind(a);
}

function effectiveRole(a: Anchor, earlier: Anchor[]): AnchorRole {
  if (a.roleOverride != null) return a.roleOverride;
  return inferredRoleFor(a, earlier);
}

// Timing mode the user is using right now. If they haven't explicitly
// picked one, we infer from the kind + role:
//   • Stay / return-to-room → around_then (they want Khonsera to fit it)
//   • Station                → leave_by   (the "catch by" time IS departure)
//   • Everything else        → arrive_by
function effectiveTimingMode(a: Anchor): TimingMode {
  if (a.timingModeOverride) return a.timingMode;
  return inferredTimingMode(a);
}

function inferredTimingMode(a: Anchor): TimingMode {
  const kind = effectiveKind(a);
  const role = a.roleOverride;
  if (kind === "stay" && role === "return_to_room") return "around_then";
  if (kind === "station") return "leave_by";
  return "arrive_by";
}

function inferredKind(a: Anchor): AnchorKind {
  if (!a.place) return "appointment";
  if (a.place.kind !== "location") return "appointment";
  switch (a.place.location_type) {
    case "hotel":
      return "stay";
    case "station":
      return "station";
    default:
      return "appointment";
  }
}

function inferredRoleFor(a: Anchor, earlier: Anchor[]): AnchorRole {
  const k = effectiveKind(a);
  if (k === "appointment") return null;
  if (k === "stay") {
    const priorStay = earlier.find(
      (other) =>
        other.place &&
        a.place &&
        samePlace(other.place, a.place) &&
        effectiveKind(other) === "stay" &&
        (other.roleOverride ?? "check_in") === "check_in" &&
        anchorWithinStay(a, other),
    );
    return priorStay ? "return_to_room" : "check_in";
  }
  if (k === "meal") {
    const hour = parseInt(a.time.split(":")[0] ?? "12", 10);
    if (hour < 11) return "breakfast";
    if (hour < 16) return "lunch";
    if (hour < 21) return "dinner";
    return "drinks";
  }
  if (k === "event") return "session";
  if (k === "station") return "train";
  return null;
}

function samePlace(a: PlaceSelection, b: PlaceSelection): boolean {
  if (a.kind === "location" && b.kind === "location") {
    return a.location_id === b.location_id;
  }
  if (a.kind === "customer_site" && b.kind === "customer_site") {
    return a.customer_site_id === b.customer_site_id;
  }
  if (a.kind === "customer" && b.kind === "customer") {
    return a.customer_id === b.customer_id;
  }
  return false;
}

function anchorWithinStay(anchor: Anchor, stay: Anchor): boolean {
  // Returns true if anchor's start is between stay's check-in (date+time)
  // and stay's check-out (date+time, with sensible defaults).
  const start = `${anchor.date}T${anchor.time}`;
  const ci = `${stay.date}T${stay.time}`;
  const coDate = stay.checkOutDate || nextDay(stay.date);
  const coTime = stay.checkOutTime || "11:00";
  const co = `${coDate}T${coTime}`;
  return start >= ci && start <= co;
}

function labelForKind(k: AnchorKind): string {
  switch (k) {
    case "stay":
      return "Stay";
    case "meal":
      return "Meal";
    case "event":
      return "Event";
    case "station":
      return "Station";
    default:
      return "Appointment";
  }
}

function labelForRole(kind: AnchorKind, value: string): string {
  return ROLES[kind].find((r) => r.value === value)?.label ?? value;
}

function emptyAnchor(date: string): Anchor {
  return {
    uid: cryptoUid(),
    place: null,
    kindOverride: null,
    roleOverride: null,
    date,
    time: "09:00",
    timingMode: "arrive_by",
    timingModeOverride: false,
    durationMins: 60,
    checkOutDate: nextDay(date),
    checkOutTime: "11:00",
  };
}

function cryptoUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `a_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// Anchors are sorted chronologically by check-in date+time. Two
// exceptions:
//   * around_then anchors have no fixed time — sorting them by date+00:00
//     would always shove them above their daytime siblings. Instead we
//     give them the date+time of the nearest dated anchor that comes
//     before them in their *original* insertion order, with a tiebreaker
//     suffix so they sort immediately after that anchor. This keeps the
//     user's intended position when they say "fit this between A and C".
//   * Anchors without any date sort to the end (newly-added blanks).
// Original insertion index is also used as a tiebreaker so the sort is
// stable for anchors sharing the same date+time.
function sortAnchorsByTime(anchors: Anchor[]): Anchor[] {
  const idxPad = (i: number) => String(i).padStart(4, "0");
  const keyed = anchors.map((a, i) => {
    if (a.timingMode === "around_then") {
      let prev = i - 1;
      while (prev >= 0 && anchors[prev].timingMode === "around_then") prev--;
      const anchor = prev >= 0 ? anchors[prev] : null;
      const base = anchor?.date
        ? `${anchor.date} ${anchor.time || "00:00"}`
        : "￿";
      return { a, key: `${base}.${idxPad(i)}` };
    }
    const base = a.date ? `${a.date} ${a.time || "00:00"}` : "￿";
    return { a, key: `${base}.${idxPad(i)}` };
  });
  keyed.sort((x, y) => x.key.localeCompare(y.key));
  return keyed.map(({ a }) => a);
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
  // Two weeks of day chips. The pill row scrolls horizontally on
  // mobile so the long tail is one swipe away. The date input itself
  // is always the fallback for further-out trips.
  for (let i = 2; i <= 14; i++) {
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
