"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { FormError } from "@/components/ui/form";
import { createItineraryFromBrief } from "@/lib/actions/itineraries";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";
import {
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";
import {
  AddBetween,
  AnchorCard,
  HOME_UID,
  JourneySpine,
  StopoverCard,
  TRANSITION_OPTIONS,
  TransitionRow,
  anchorWithinStay,
  buildDatePresets,
  defaultAnchorDate,
  effectiveKind,
  effectiveRole,
  effectiveTimingMode,
  emptyAnchor,
  emptyStopover,
  emptyTransition,
  samePlace,
  sortAnchorsByTime,
  stopoverAsAnchor,
  stopoverUid,
  transitionKey,
  useRoutePreviewsForPlaces,
  type Anchor,
  type BriefTransition,
  type LocalMode,
  type ModePreviewMap,
  type Stopover,
  type TransitionMode,
} from "@/components/itinerary";
import type { PlaceSelection } from "@/components/place-picker";

export function NewItineraryBrief({
  customers,
  customerSites,
  locations,
  timezone,
  homeLabel,
  railHubLabel,
  flightHubLabel,
}: {
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  timezone: string;
  homeLabel: string | null;
  // Labels for the user's default rail station / airport. The spine
  // surfaces them inside train / tube / flight via rows so a planning
  // user sees "via Wellingborough (WLB)" without having to manually
  // add a station stop. Either can be null when the user hasn't set
  // a default in settings.
  railHubLabel?: string | null;
  flightHubLabel?: string | null;
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
    const svUid = stopoverUid(fromUid, toUid);
    setStopovers((prev) => {
      const next = new Map(prev);
      next.delete(transitionKey(fromUid, toUid));
      return next;
    });
    // A stopover splits the parent transition into two leg transitions
    // (anchor → stopover, stopover → anchor). When the stopover goes
    // away we also drop those leg entries so the parent (fromUid, toUid)
    // transition takes over again — without this the leg modes would
    // linger in state and re-apply if the user re-added a stopover.
    setTransitions((prev) => {
      const next = new Map(prev);
      next.delete(transitionKey(fromUid, svUid));
      next.delete(transitionKey(svUid, toUid));
      return next;
    });
  };

  // Adding a stopover splits the existing single transition into two
  // independently-editable legs. We seed both new legs with the
  // parent's mode/booking so a user who already said "we're walking
  // this leg" doesn't have to re-pick walk twice — they can edit
  // either leg afterwards.
  const addStopover = (fromUid: string, toUid: string) => {
    const parent = getTransition(fromUid, toUid);
    const svUid = stopoverUid(fromUid, toUid);
    setTransitions((prev) => {
      const next = new Map(prev);
      next.set(transitionKey(fromUid, svUid), { ...parent });
      next.set(transitionKey(svUid, toUid), { ...parent });
      return next;
    });
    setStopovers((prev) => {
      const next = new Map(prev);
      next.set(transitionKey(fromUid, toUid), emptyStopover());
      return next;
    });
  };

  const datePresets = useMemo(() => buildDatePresets(timezone), [timezone]);

  // Per-mode travel-time hints — same UX as the editor but keyed on
  // PlaceSelection because the brief has no stop_ids yet. Only saved
  // places (location_id / customer_site_id) get hints; free-text
  // labels stay quiet until the user picks something concrete.
  const briefPreviews = useRoutePreviewsForPlaces();
  const briefPreviewsForPair = (
    from: PlaceSelection | null,
    to: PlaceSelection | null,
  ): ModePreviewMap => {
    const out: ModePreviewMap = {};
    for (const opt of TRANSITION_OPTIONS) {
      if (opt.value === "auto" || opt.value === "mixed") continue;
      const entry = briefPreviews.get(from, to, opt.value);
      if (entry) out[opt.value] = entry;
    }
    return out;
  };
  const briefPrefetchPair = (
    from: PlaceSelection | null,
    to: PlaceSelection | null,
  ) => {
    if (!from || !to) return;
    for (const opt of TRANSITION_OPTIONS) {
      if (opt.value === "auto" || opt.value === "mixed") continue;
      briefPreviews.fetchPreview(from, to, opt.value);
    }
  };

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
      const currentRole = effectiveRole(a, anchors.slice(0, i));
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
          // Then each adjacent pair. When a stopover sits between the
          // pair we skip the parent (anchor → anchor) transition and
          // instead send the two leg transitions around the stopover —
          // anchor → sv::A::B and sv::A::B → anchor. The server
          // resolves the svUid sentinel to the real stopover stop_id
          // it inserts (migration 0014 made stopovers real stops).
          for (let i = 0; i < anchors.length - 1; i++) {
            const a = anchors[i];
            const next = anchors[i + 1];
            const sv = stopovers.get(transitionKey(a.uid, next.uid));
            if (sv) {
              const svUid = stopoverUid(a.uid, next.uid);
              serialize(a.uid, svUid, getTransition(a.uid, svUid));
              serialize(svUid, next.uid, getTransition(svUid, next.uid));
              continue;
            }
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
              {next
                ? (() => {
                    const sv = getStopover(anchor.uid, next.uid);
                    if (sv) {
                      const svUid = stopoverUid(anchor.uid, next.uid);
                      const svAnchor = stopoverAsAnchor(sv, svUid);
                      return (
                        <>
                          <TransitionRow
                            from={anchor}
                            to={svAnchor}
                            transition={getTransition(anchor.uid, svUid)}
                            modePreviews={briefPreviewsForPair(
                              anchor.place,
                              sv.place,
                            )}
                            onOpenChange={(open) => {
                              if (open)
                                briefPrefetchPair(anchor.place, sv.place);
                            }}
                            onChange={(patch) =>
                              setTransition(anchor.uid, svUid, patch)
                            }
                          />
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
                            onRemove={() =>
                              removeStopover(anchor.uid, next.uid)
                            }
                          />
                          <TransitionRow
                            from={svAnchor}
                            to={next}
                            transition={getTransition(svUid, next.uid)}
                            modePreviews={briefPreviewsForPair(
                              sv.place,
                              next.place,
                            )}
                            onOpenChange={(open) => {
                              if (open)
                                briefPrefetchPair(sv.place, next.place);
                            }}
                            onChange={(patch) =>
                              setTransition(svUid, next.uid, patch)
                            }
                          />
                        </>
                      );
                    }
                    return (
                      <>
                        <TransitionRow
                          from={anchor}
                          to={next}
                          transition={getTransition(anchor.uid, next.uid)}
                          modePreviews={briefPreviewsForPair(
                            anchor.place,
                            next.place,
                          )}
                          onOpenChange={(open) => {
                            if (open)
                              briefPrefetchPair(anchor.place, next.place);
                          }}
                          onChange={(patch) =>
                            setTransition(anchor.uid, next.uid, patch)
                          }
                        />
                        <button
                          type="button"
                          className="brief-add-stop-trigger"
                          onClick={() => addStopover(anchor.uid, next.uid)}
                          title="Drop in somewhere between these two anchors"
                        >
                          + Add a stop between these
                        </button>
                      </>
                    );
                  })()
                : null}
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
        <JourneySpine
          anchors={anchors}
          transitions={transitions}
          stopovers={stopovers}
          titleOverride={titleOverride}
          timezone={timezone}
          railHubLabel={railHubLabel ?? null}
          flightHubLabel={flightHubLabel ?? null}
        />
      </aside>
    </div>
  );
}

// Decorative arrow on the "Build my day" submit button. Only used here
// — not worth promoting to the shared icons module.
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
