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
  TransportBookingCard,
  AccommodationBookingCard,
  anchorEndDate,
  anchorStartDate,
  anchorWithinStay,
  buildDatePresets,
  defaultAnchorDate,
  effectiveKind,
  effectiveRole,
  effectiveTimingMode,
  emptyAnchor,
  emptyStopover,
  emptyTransition,
  emptyTransportBookingItem,
  returnTransportBooking,
  emptyAccommodationBookingItem,
  samePlace,
  sortAnchorsByTime,
  stopoverAsAnchor,
  stopoverUid,
  transitionKey,
  useRoutePreviewsForPlaces,
  type Anchor,
  type BriefTransition,
  type BriefTransportBooking,
  type BriefAccommodationBooking,
  type LocalMode,
  type ModePreviewMap,
  type Stopover,
  type TransitionMode,
} from "@/components/itinerary";
import { checkLegFeasibility } from "@/lib/feasibility/check";
import { TransportIcon } from "@/components/icons";
import { TrainTicketCard, type TicketSegment } from "@/components/train-ticket-card";
import { GapModePicker, type GapMode } from "@/components/gap-mode-picker";
import { scanGmailForBookings } from "@/lib/actions/gmail";
import type { ParsedBooking } from "@/lib/gmail/types";
import type { PlaceSelection } from "@/components/place-picker";

function hubAsPlace(hub: { id: string | null; label: string | null }): PlaceSelection | null {
  if (!hub.id && !hub.label) return null;
  return {
    kind: "location" as const,
    location_id: "",
    label: hub.label ?? "Station",
    location_type: "other" as const,
    transport_hub_id: hub.id,
  } as PlaceSelection & { transport_hub_id: string | null };
}

const MODE_OPTIONS_MAP: Record<string, string> = {
  train: "Train",
  flight: "Flight",
  taxi: "Taxi",
  bus: "Bus",
  tube: "Tube",
  drive: "Car hire",
};
import {
  BaseLocationCard,
  type BaseLocation,
} from "./base-location-card";
import { BeHomeByField } from "./be-home-by-field";

export function NewItineraryBrief({
  customers,
  customerSites,
  locations,
  timezone,
  homeLabel,
  railHubLabel,
  flightHubLabel,
  baseLocations,
  defaultBaseId,
  gmailConnected,
}: {
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  timezone: string;
  homeLabel: string | null;
  railHubLabel?: string | null;
  flightHubLabel?: string | null;
  baseLocations: BaseLocation[];
  defaultBaseId: string | null;
  gmailConnected?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  const [anchors, setAnchors] = useState<Anchor[]>([]);
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

  // Base location — explicit pick from home/office locations.
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(
    defaultBaseId ?? baseLocations[0]?.id ?? null,
  );
  const selectedBase = baseLocations.find((b) => b.id === selectedBaseId);
  const baseName = selectedBase?.name ?? homeLabel ?? "Home";

  // "Be home by" constraint.
  const [beHomeBy, setBeHomeBy] = useState<{
    date: string;
    time: string;
  } | null>(null);

  // Standalone booking cards.
  const [transportBookings, setTransportBookings] = useState<
    BriefTransportBooking[]
  >([]);
  const [accommodationBookings, setAccommodationBookings] = useState<
    BriefAccommodationBooking[]
  >([]);

  // Trip date range — set explicitly by the user, used to default
  // booking dates and anchor dates.
  const [tripStartDate, setTripStartDate] = useState(defaultAnchorDate());
  const [tripEndDate, setTripEndDate] = useState(defaultAnchorDate());

  const updateTransportBooking = (
    uid: string,
    patch: Partial<BriefTransportBooking>,
  ) =>
    setTransportBookings((prev) =>
      prev.map((b) => (b.uid === uid ? { ...b, ...patch } : b)),
    );
  const removeTransportBooking = (uid: string) =>
    setTransportBookings((prev) => prev.filter((b) => b.uid !== uid));

  const updateAccommodationBooking = (
    uid: string,
    patch: Partial<BriefAccommodationBooking>,
  ) =>
    setAccommodationBookings((prev) =>
      prev.map((b) => (b.uid === uid ? { ...b, ...patch } : b)),
    );
  const removeAccommodationBooking = (uid: string) =>
    setAccommodationBookings((prev) => prev.filter((b) => b.uid !== uid));

  const [gmailImportOpen, setGmailImportOpen] = useState(false);

  const importParsedBooking = (b: ParsedBooking) => {
    if (b.type === "transport") {
      // Split outbound/return: detect where the direction reverses.
      // E.g. WEL→LEI, LEI→DER, DER→LEI, LEI→WEL — the reversal is
      // at index 2 (DER→LEI goes back toward WEL).
      const segs = b.segments;
      let splitAt = segs.length;
      if (segs.length >= 4) {
        for (let i = 1; i < segs.length; i++) {
          if (segs[i].from_station === segs[i - 1].to_station &&
              segs[i].to_station === segs[Math.max(0, i - 2)]?.from_station) {
            splitAt = i;
            break;
          }
        }
        // Simpler heuristic: if first leg origin equals last leg destination,
        // it's a return trip — split in half.
        if (splitAt === segs.length && segs[0].from_station === segs[segs.length - 1].to_station) {
          splitAt = Math.ceil(segs.length / 2);
        }
      }
      const outbound = segs.slice(0, splitAt);
      const returnSegs = segs.slice(splitAt);

      const makeBooking = (legs: typeof segs) => {
        const first = legs[0];
        const last = legs[legs.length - 1];
        return {
          ...emptyTransportBookingItem(),
          mode: (b.mode === "bus" ? "bus" : b.mode) as any,
          date: first?.departure_date ?? tripStartDate,
          departureHub: { id: null, label: first?.from_station ?? null },
          destinationHub: { id: null, label: last?.to_station ?? null },
          departTime: first?.departure_time ?? "",
          arriveTime: last?.arrival_time ?? "",
          changeovers: legs.length > 1
            ? legs.slice(0, -1).map((seg, i) => ({
                hub: { id: null, label: seg.to_station },
                arriveTime: seg.arrival_time,
                departTime: legs[i + 1]?.departure_time ?? "",
              }))
            : [],
          serviceNumber: first?.service_number ?? "",
          reference: b.booking_reference ?? "",
          seat: first?.seat ?? "",
          price: b.price != null ? String(b.price) : "",
          confirmed: true,
          operator: first?.operator ?? null,
          ticketType: first?.ticket_type ?? null,
          routeRestriction: first?.route_restriction ?? null,
          barcodes: legs.map((seg) => ({
            ref: seg.barcode_ref ?? null,
            data: seg.barcode_data ?? null,
          })),
        };
      };

      setTransportBookings((prev) => {
        const next = [...prev, makeBooking(outbound)];
        if (returnSegs.length > 0) next.push(makeBooking(returnSegs));
        return next;
      });

      // Auto-update trip dates to match the booking. If dates are still
      // at the default (tomorrow), replace them entirely. Otherwise expand
      // the range to encompass the booking.
      const bookingDate = outbound[0]?.departure_date;
      const defaultDate = defaultAnchorDate();
      if (bookingDate) {
        setTripStartDate((prev) =>
          prev === defaultDate ? bookingDate : (bookingDate < prev ? bookingDate : prev),
        );
        setTripEndDate((prev) =>
          prev === defaultDate ? bookingDate : (bookingDate > prev ? bookingDate : prev),
        );
      }
    } else {
      setAccommodationBookings((prev) => [
        ...prev,
        {
          ...emptyAccommodationBookingItem(),
          hotel: null,
          checkInDate: b.check_in_date,
          checkInTime: b.check_in_time ?? "15:00",
          checkOutDate: b.check_out_date,
          checkOutTime: b.check_out_time ?? "11:00",
          provider: b.provider,
          reference: b.booking_reference ?? "",
          price: b.price != null ? String(b.price) : "",
          room: b.room_details ?? "",
          confirmed: true,
        },
      ]);
    }
  };

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
  // Eager prefetch the chosen mode for each adjacent pair so the
  // footer summary can flag late / tight legs without the user
  // opening every picker. Only fires for pairs with two saved
  // places (free-text labels have no coords). Cheap when cached —
  // useRoutePreviewsForPlaces dedupes on the same key.
  useEffect(() => {
    for (let i = 0; i < anchors.length - 1; i++) {
      const from = anchors[i].place;
      const to = anchors[i + 1].place;
      const t = transitions.get(transitionKey(anchors[i].uid, anchors[i + 1].uid));
      if (!t || t.mode === "auto" || t.mode === "mixed") continue;
      briefPreviews.fetchPreview(from, to, t.mode);
    }
    // briefPreviews is a stable hook; depending on anchors + transitions
    // refires whenever the user edits either.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchors, transitions]);

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
    const seed = emptyAnchor(previous?.date ?? tripStartDate);
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

  const canSubmit =
    anchors.length > 0 && anchors.every((a) => a.place != null);

  // Roll up feasibility flags across every adjacent pair the user
  // has actually committed to a mode for. Pairs left on "auto" or
  // with pending previews stay silent — we don't claim to know
  // something is wrong until we have the duration to back it up.
  const feasibilityRollup = useMemo(() => {
    let late = 0;
    let tight = 0;
    for (let i = 0; i < anchors.length - 1; i++) {
      const from = anchors[i];
      const to = anchors[i + 1];
      const t = transitions.get(transitionKey(from.uid, to.uid));
      if (!t || t.mode === "auto" || t.mode === "mixed") continue;
      const preview = briefPreviews.get(from.place, to.place, t.mode);
      if (!preview || preview === "pending") continue;
      const result = checkLegFeasibility({
        fromEnd: anchorEndDate(from),
        toStart: anchorStartDate(to),
        travelMinutes: preview.durationMinutes,
      });
      if (result.state === "late") late++;
      else if (result.state === "tight") tight++;
    }
    return { late, tight };
    // briefPreviews.get reads cache state that updates via the hook's
    // internal force-render; depending on anchors + transitions covers
    // every user-facing change that should re-run the rollup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchors, transitions, briefPreviews]);

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
            notes: a.notes || null,
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
                    price: t.booking.price
                      ? Number(t.booking.price)
                      : null,
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
        base_location_id: selectedBaseId,
        be_home_by: beHomeBy,
        transport_bookings: transportBookings
          .filter((tb) => tb.mode != null)
          .map((tb) => ({
            mode: tb.mode!,
            date: tb.date || null,
            departure_hub_id: tb.departureHub.id,
            departure_label: tb.departureHub.label,
            destination_hub_id: tb.destinationHub.id,
            destination_label: tb.destinationHub.label,
            depart_time: tb.departTime || null,
            arrive_time: tb.arriveTime || null,
            changeovers: tb.changeovers
              .filter((co) => co.hub.id || co.hub.label)
              .map((co) => ({
                hub_id: co.hub.id,
                hub_label: co.hub.label,
                arrive_time: co.arriveTime || null,
                depart_time: co.departTime || null,
              })),
            service_number: tb.serviceNumber || null,
            reference: tb.reference || null,
            seat: tb.seat || null,
            price: tb.price ? Number(tb.price) : null,
            operator: tb.operator || null,
            ticket_type: tb.ticketType || null,
            route_restriction: tb.routeRestriction || null,
            barcodes: tb.barcodes,
          })),
        accommodation_bookings: accommodationBookings
          .filter((ab) => ab.hotel != null || ab.checkInDate)
          .map((ab) => ({
            hotel_location_id:
              ab.hotel?.kind === "location" ? ab.hotel.location_id : null,
            hotel_label: ab.hotel?.label ?? null,
            check_in_date: ab.checkInDate || null,
            check_in_time: ab.checkInTime || "15:00",
            check_out_date: ab.checkOutDate || null,
            check_out_time: ab.checkOutTime || "11:00",
            provider: ab.provider || null,
            reference: ab.reference || null,
            price: ab.price ? Number(ab.price) : null,
            room: ab.room || null,
          })),
      });

      if (!result.ok) {
        setFeedback(feedbackFromError(result.error));
        return;
      }
      router.push(`/itineraries/${result.value.id}`);
      router.refresh();
    });
  };

  // ── Build unified chronological timeline entries ──────────────────
  type TimelineEntry =
    | { kind: "transport"; booking: BriefTransportBooking }
    | { kind: "anchor"; anchor: Anchor; index: number };

  const timelineEntries = useMemo(() => {
    const entries: TimelineEntry[] = [];
    anchors.forEach((a, i) => entries.push({ kind: "anchor", anchor: a, index: i }));
    transportBookings
      .filter((tb) => tb.confirmed && tb.mode)
      .forEach((tb) => entries.push({ kind: "transport", booking: tb }));
    entries.sort((a, b) => {
      const aTime =
        a.kind === "anchor"
          ? `${a.anchor.date}T${a.anchor.time}`
          : `${a.booking.date}T${a.booking.departTime}`;
      const bTime =
        b.kind === "anchor"
          ? `${b.anchor.date}T${b.anchor.time}`
          : `${b.booking.date}T${b.booking.departTime}`;
      return aTime.localeCompare(bTime);
    });
    return entries;
  }, [anchors, transportBookings]);

  // Find the first departure time for "leave by" display
  const firstDepartTime = transportBookings
    .filter((tb) => tb.confirmed && tb.departTime)
    .sort((a, b) => `${a.date}T${a.departTime}`.localeCompare(`${b.date}T${b.departTime}`))
    [0]?.departTime ?? null;

  // Find contextual gaps between transport bookings
  const findGapInfo = (
    prevEntry: TimelineEntry | null,
    nextEntry: TimelineEntry | null,
  ): { location: string; from: string; to: string; gapMinutes: number } | null => {
    if (!prevEntry || !nextEntry) return null;
    // Gap between outbound arrival and return departure
    if (prevEntry.kind === "transport" && nextEntry.kind === "transport") {
      const arriveTime = prevEntry.booking.arriveTime;
      const departTime = nextEntry.booking.departTime;
      const dest = prevEntry.booking.destinationHub?.label;
      if (arriveTime && departTime && dest) {
        const [ah, am] = arriveTime.split(":").map(Number);
        const [dh, dm] = departTime.split(":").map(Number);
        const gap = (dh * 60 + dm) - (ah * 60 + am);
        if (gap > 0) return { location: dest, from: arriveTime, to: departTime, gapMinutes: gap };
      }
    }
    // Gap between transport arrival and anchor
    if (prevEntry.kind === "transport" && nextEntry.kind === "anchor") {
      const arriveTime = prevEntry.booking.arriveTime;
      const dest = prevEntry.booking.destinationHub?.label;
      if (arriveTime && dest) {
        return { location: dest, from: arriveTime, to: nextEntry.anchor.time, gapMinutes: 0 };
      }
    }
    return null;
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>
      <FormError message={feedback?.message} />

      {/* ── Date + Base ───────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ padding: "12px 16px" }}>
          <span className="uc" style={{ fontSize: 10 }}>Trip date</span>
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <input
              type="date"
              className="field"
              value={tripStartDate}
              onChange={(e) => setTripStartDate(e.target.value)}
              style={{ flex: 1, minWidth: 130, fontSize: 13 }}
            />
            {tripStartDate !== tripEndDate && (
              <>
                <span style={{ color: "var(--ink-faint)", alignSelf: "center" }}>to</span>
                <input
                  type="date"
                  className="field"
                  value={tripEndDate}
                  onChange={(e) => setTripEndDate(e.target.value)}
                  style={{ flex: 1, minWidth: 130, fontSize: 13 }}
                />
              </>
            )}
          </div>
        </div>
        <BaseLocationCard
          baseLocations={baseLocations}
          defaultBaseId={defaultBaseId}
          selectedBaseId={selectedBaseId}
          onSelect={setSelectedBaseId}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          THE TIMELINE — single chronological stream
          ════════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 20 }}>
        {/* ── Home row ─────────────────────────────────────────── */}
        <div
          className="card"
          style={{
            padding: "12px 16px",
            marginBottom: 12,
            borderLeft: "3px solid var(--ink-faint)",
          }}
        >
          <span className="uc" style={{ fontSize: 10 }}>Home</span>
          <div style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 16, color: "var(--ink)", marginTop: 2 }}>
            {baseName}
          </div>
          {selectedBase?.address && (
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
              {selectedBase.address}
            </div>
          )}
          {firstDepartTime && (() => {
            const BUFFER_MINS = 10;
            // Check if user has set a mode for home→station gap
            const homeToStationTransition = transitions.get(
              transitionKey(HOME_UID, "home::transport_dep"),
            );
            const homeToStationMode = homeToStationTransition?.mode;
            const firstTb = transportBookings
              .filter((tb) => tb.confirmed && tb.departTime)
              .sort((a, b) => `${a.date}T${a.departTime}`.localeCompare(`${b.date}T${b.departTime}`))[0];
            const stationPlace = firstTb ? hubAsPlace(firstTb.departureHub) : null;
            const homePlace: PlaceSelection | null = selectedBase
              ? { kind: "location" as const, location_id: selectedBaseId ?? "", label: baseName, location_type: "home" as const }
              : null;
            const preview = homeToStationMode && homeToStationMode !== "auto"
              ? briefPreviewsForPair(homePlace, stationPlace)[homeToStationMode]
              : null;
            const travelMins = preview && preview !== "pending" ? preview.durationMinutes : null;

            if (travelMins != null) {
              const [h, m] = firstDepartTime.split(":").map(Number);
              const totalMins = h * 60 + m - travelMins - BUFFER_MINS;
              const leaveH = Math.floor(totalMins / 60);
              const leaveM = totalMins % 60;
              const leaveBy = `${String(leaveH).padStart(2, "0")}:${String(leaveM).padStart(2, "0")}`;
              return (
                <div className="mono" style={{ fontSize: 12, color: "var(--gold-2)", marginTop: 6, fontWeight: 500 }}>
                  Leave by {leaveBy}
                  <span style={{ fontWeight: 400, color: "var(--ink-dim)", marginLeft: 8, fontSize: 11 }}>
                    {travelMins} min {homeToStationMode} + {BUFFER_MINS} min buffer
                  </span>
                </div>
              );
            }
            return (
              <div className="mono" style={{ fontSize: 12, color: "var(--gold-2)", marginTop: 6, fontWeight: 500 }}>
                Catch the {firstDepartTime} train
              </div>
            );
          })()}
        </div>

        {/* ── Timeline entries ──────────────────────────────────── */}
        {timelineEntries.length === 0 && !transportBookings.some((tb) => !tb.confirmed) ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 16px",
              color: "var(--ink-dim)",
              fontSize: 14,
            }}
          >
            <p style={{ margin: "0 0 12px" }}>
              Start by adding your bookings or appointments.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {gmailConnected ? (
                <button
                  type="button"
                  className="btn btn-gold btn-sm"
                  onClick={() => setGmailImportOpen(true)}
                >
                  Scan for tickets
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setTransportBookings((prev) => [
                    ...prev,
                    { ...emptyTransportBookingItem(), date: tripStartDate },
                  ])
                }
              >
                + Transport
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => insertAnchorAt(0)}
              >
                + Add a stop
              </button>
            </div>
          </div>
        ) : null}

        {/* Active (unconfirmed) booking forms */}
        {transportBookings
          .filter((tb) => !tb.confirmed)
          .map((tb) => (
            <div key={tb.uid} style={{ marginBottom: 12 }}>
              <TransportBookingCard
                booking={tb}
                onChange={(patch) => updateTransportBooking(tb.uid, patch)}
                onRemove={() => removeTransportBooking(tb.uid)}
              />
            </div>
          ))}
        {accommodationBookings
          .filter((ab) => !ab.confirmed)
          .map((ab) => (
            <div key={ab.uid} style={{ marginBottom: 12 }}>
              <AccommodationBookingCard
                booking={ab}
                customers={customers}
                customerSites={customerSites}
                locations={locations}
                onChange={(patch) => updateAccommodationBooking(ab.uid, patch)}
                onRemove={() => removeAccommodationBooking(ab.uid)}
              />
            </div>
          ))}

        {/* Render the unified timeline */}
        {timelineEntries.map((entry, entryIdx) => {
          const prevEntry = entryIdx > 0 ? timelineEntries[entryIdx - 1] : null;
          const nextEntry = entryIdx < timelineEntries.length - 1 ? timelineEntries[entryIdx + 1] : null;

          // ── Mode picker gap before this entry ──
          let gapBefore = null;
          if (entryIdx === 0) {
            // Home → first entry
            if (entry.kind === "anchor") {
              gapBefore = (
                <TransitionRow
                  from={null}
                  to={entry.anchor}
                  transition={getTransition(HOME_UID, entry.anchor.uid)}
                  onChange={(patch) => setTransition(HOME_UID, entry.anchor.uid, patch)}
                  fromVirtualLabel={baseName}
                  modePreviews={briefPreviewsForPair(
                    selectedBase ? { kind: "location" as const, location_id: selectedBaseId ?? "", label: baseName, location_type: "home" as const } : null,
                    entry.anchor.place,
                  )}
                  onOpenChange={(open) => {
                    if (open && entry.anchor.place) {
                      briefPrefetchPair(
                        selectedBase ? { kind: "location" as const, location_id: selectedBaseId ?? "", label: baseName, location_type: "home" as const } : null,
                        entry.anchor.place,
                      );
                    }
                  }}
                />
              );
            } else {
              // Home → transport departure
              const toLabel = entry.booking.departureHub?.label ?? "station";
              gapBefore = (
                <GapModePicker
                  selected={null}
                  onSelect={() => {}}
                  fromLabel={baseName}
                  toLabel={toLabel}
                />
              );
            }
          } else if (prevEntry?.kind === "transport" && entry.kind === "anchor") {
            const fromLabel = prevEntry.booking.destinationHub?.label ?? "station";
            const toLabel = entry.anchor.place?.label ?? "appointment";
            gapBefore = (
              <GapModePicker
                selected={null}
                onSelect={() => {}}
                fromLabel={fromLabel}
                toLabel={toLabel}
              />
            );
          } else if (prevEntry?.kind === "anchor" && entry.kind === "transport") {
            const fromLabel = prevEntry.anchor.place?.label ?? "stop";
            const toLabel = entry.booking.departureHub?.label ?? "station";
            gapBefore = (
              <GapModePicker
                selected={null}
                onSelect={() => {}}
                fromLabel={fromLabel}
                toLabel={toLabel}
              />
            );
          } else if (prevEntry?.kind === "transport" && entry.kind === "transport") {
            // Between two transport bookings — contextual gap handles the main prompt,
            // but also show a gap mode picker if there are anchors between them
          } else if (prevEntry?.kind === "anchor" && entry.kind === "anchor") {
            // Anchor → anchor: standard transition
            const prev = prevEntry.anchor;
            const cur = entry.anchor;
            const sv = getStopover(prev.uid, cur.uid);
            if (sv) {
              const svUid = stopoverUid(prev.uid, cur.uid);
              const svAnchor = stopoverAsAnchor(sv, svUid);
              gapBefore = (
                <>
                  <TransitionRow
                    from={prev}
                    to={svAnchor}
                    transition={getTransition(prev.uid, svUid)}
                    modePreviews={briefPreviewsForPair(prev.place, sv.place)}
                    onOpenChange={(open) => { if (open) briefPrefetchPair(prev.place, sv.place); }}
                    onChange={(patch) => setTransition(prev.uid, svUid, patch)}
                  />
                  <StopoverCard
                    stopover={sv}
                    fromAnchor={prev}
                    toAnchor={cur}
                    customers={customers}
                    customerSites={customerSites}
                    locations={locations}
                    onChange={(patch) => setStopoverPatch(prev.uid, cur.uid, patch)}
                    onRemove={() => removeStopover(prev.uid, cur.uid)}
                  />
                  <TransitionRow
                    from={svAnchor}
                    to={cur}
                    transition={getTransition(svUid, cur.uid)}
                    modePreviews={briefPreviewsForPair(sv.place, cur.place)}
                    onOpenChange={(open) => { if (open) briefPrefetchPair(sv.place, cur.place); }}
                    onChange={(patch) => setTransition(svUid, cur.uid, patch)}
                  />
                </>
              );
            } else {
              gapBefore = (
                <TransitionRow
                  from={prev}
                  to={cur}
                  transition={getTransition(prev.uid, cur.uid)}
                  modePreviews={briefPreviewsForPair(prev.place, cur.place)}
                  onOpenChange={(open) => { if (open) briefPrefetchPair(prev.place, cur.place); }}
                  onChange={(patch) => setTransition(prev.uid, cur.uid, patch)}
                />
              );
            }
          }

          // ── Contextual gap: "You're in Derby from 08:32 to 15:08" ──
          let contextGap = null;
          if (prevEntry?.kind === "transport" && entry.kind === "transport") {
            const gap = findGapInfo(prevEntry, entry);
            if (gap && gap.gapMinutes > 0) {
              const hours = Math.floor(gap.gapMinutes / 60);
              const mins = gap.gapMinutes % 60;
              const durLabel = hours > 0
                ? `${hours}h${mins > 0 ? ` ${mins}m` : ""}`
                : `${mins}m`;
              contextGap = (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 12px",
                    color: "var(--ink-dim)",
                  }}
                >
                  <p
                    className="serif-i"
                    style={{ margin: "0 0 10px", fontSize: 14 }}
                  >
                    You're in {gap.location} for {durLabel}
                  </p>
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-faint)" }}>
                    {gap.from} to {gap.to}
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => insertAnchorAt(anchors.length)}
                  >
                    What are you doing here?
                  </button>
                </div>
              );
            }
          }

          // ── Render the entry ──
          if (entry.kind === "transport") {
            const tb = entry.booking;
            // Build individual leg segments (split by changeovers)
            const legs: TicketSegment[] = [];
            const stops = [
              { label: tb.departureHub?.label ?? "?", time: tb.departTime || "" },
              ...tb.changeovers.map((co) => ({ label: co.hub?.label ?? "?", time: co.departTime || "" })),
              { label: tb.destinationHub?.label ?? "?", time: tb.arriveTime || "" },
            ];
            for (let li = 0; li < stops.length - 1; li++) {
              const bc = tb.barcodes[li];
              legs.push({
                from_station: stops[li].label,
                to_station: stops[li + 1].label,
                from_station_code: null,
                to_station_code: null,
                departure_date: tb.date || "",
                departure_time: stops[li].time,
                arrival_time: li < stops.length - 2 ? (tb.changeovers[li]?.arriveTime || "") : (tb.arriveTime || ""),
                operator: tb.operator ?? null,
                route_restriction: tb.routeRestriction ?? null,
                ticket_type: tb.ticketType ?? null,
                coach: null,
                seat: li === 0 ? (tb.seat || null) : null,
                barcode_ref: bc?.ref ?? null,
                barcode_data: bc?.data ?? null,
                price: li === 0 && tb.price ? Number(tb.price) : null,
              });
            }
            return (
              <div key={`tl-${tb.uid}`} style={{ marginBottom: 4 }}>
                {gapBefore}
                {contextGap}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px", marginBottom: 2 }}>
                  <span className="uc" style={{ fontSize: 10, color: "var(--gold-2)" }}>
                    {tb.departTime} train to {tb.destinationHub?.label}
                  </span>
                  <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                    <button type="button" style={{ color: "var(--ink-dim)" }} onClick={() => updateTransportBooking(tb.uid, { confirmed: false })}>Edit</button>
                    <button type="button" style={{ color: "var(--rust)" }} onClick={() => removeTransportBooking(tb.uid)}>Remove</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {legs.map((leg, li) => (
                    <TrainTicketCard key={`${tb.uid}-${li}`} segment={leg} compact />
                  ))}
                </div>
              </div>
            );
          }

          // Anchor entry
          const anchor = entry.anchor;
          const anchorIdx = entry.index;
          const next = anchors[anchorIdx + 1];
          return (
            <div key={anchor.uid} style={{ marginBottom: 8 }}>
              {gapBefore}
              {contextGap}
              <AnchorCard
                anchor={anchor}
                earlier={anchors.slice(0, anchorIdx)}
                first={anchorIdx === 0}
                canRemove={true}
                customers={customers}
                customerSites={customerSites}
                locations={locations}
                datePresets={datePresets}
                onChange={(patch) => updateAnchor(anchor.uid, patch)}
                onRemove={() => removeAnchor(anchor.uid)}
              />
              {/* Show remaining free time if next entry is a transport booking */}
              {nextEntry?.kind === "transport" && anchor.time && anchor.durationMins ? (() => {
                const [h, m] = anchor.time.split(":").map(Number);
                const endMin = h * 60 + m + anchor.durationMins;
                const [dh, dm] = (nextEntry.booking.departTime || "").split(":").map(Number);
                const departMin = dh * 60 + dm;
                const freeMin = departMin - endMin;
                if (freeMin > 60) {
                  const freeH = Math.floor(freeMin / 60);
                  const freeM = freeMin % 60;
                  return (
                    <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: "var(--ink-faint)" }}>
                      {freeH}h{freeM > 0 ? ` ${freeM}m` : ""} free before your {nextEntry.booking.departTime} train
                      <br />
                      <button
                        type="button"
                        className="brief-add-stop-trigger"
                        onClick={() => insertAnchorAt(anchors.length)}
                        style={{ marginTop: 4 }}
                      >
                        + Add another stop
                      </button>
                    </div>
                  );
                }
                return null;
              })() : null}
              {next && nextEntry?.kind !== "transport" ? (
                <button
                  type="button"
                  className="brief-add-stop-trigger"
                  onClick={() => addStopover(anchor.uid, next.uid)}
                  title="Drop in somewhere between these two anchors"
                  style={{ marginTop: 4 }}
                >
                  + Add a stop between these
                </button>
              ) : null}
            </div>
          );
        })}

        {/* ── Be home by ──────────────────────────────────────── */}
        <BeHomeByField
          value={beHomeBy}
          onChange={setBeHomeBy}
          defaultDate={anchors[anchors.length - 1]?.date ?? tripStartDate}
        />

        {/* ── Home return row ──────────────────────────────────── */}
        {transportBookings.some((tb) => tb.confirmed) && (
          <div
            className="card"
            style={{
              padding: "12px 16px",
              borderLeft: "3px solid var(--ink-faint)",
              marginTop: 8,
              opacity: 0.7,
            }}
          >
            <span className="uc" style={{ fontSize: 10 }}>Home</span>
            <div style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 14, color: "var(--ink)" }}>
              Back home
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          BOTTOM ACTIONS
          ════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 16,
          paddingTop: 8,
          borderTop: "1px solid var(--rule)",
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => insertAnchorAt(anchors.length)}
        >
          + Add a stop
        </button>
        {gmailConnected ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setGmailImportOpen(true)}
          >
            Scan for tickets
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            setTransportBookings((prev) => [
              ...prev,
              { ...emptyTransportBookingItem(), date: tripStartDate },
            ])
          }
        >
          + Transport
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            setAccommodationBookings((prev) => [
              ...prev,
              {
                ...emptyAccommodationBookingItem(),
                checkInDate: tripStartDate,
                checkOutDate: tripEndDate,
              },
            ])
          }
        >
          + Hotel
        </button>
      </div>

      {/* Notes + title */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="uc">Trip notes</span>
              <button type="button" onClick={() => setNotesOn(false)} style={{ fontSize: 11.5, color: "var(--rust)" }}>Remove</button>
            </div>
            <textarea className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="The brief, dress code, who's expected — anything Khonsera should know." />
          </div>
        )}
        <details className="brief-details">
          <summary className="brief-details-summary">
            <span className="uc">Title override</span>
            <span className="brief-details-hint">{titleOverride ? `"${titleOverride}"` : "Khonsera will pick one for you"}</span>
          </summary>
          <input type="text" className="field" value={titleOverride} onChange={(e) => setTitleOverride(e.target.value)} placeholder="e.g. Belper site visit" style={{ marginTop: 8 }} />
        </details>
      </div>

      {/* Day summary */}
      {transportBookings.some((tb) => tb.confirmed) && (
        <div
          className="card"
          style={{
            padding: "14px 16px",
            marginBottom: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: "12px 24px",
            fontSize: 12,
            color: "var(--ink-dim)",
          }}
        >
          <span className="uc" style={{ width: "100%", fontSize: 10, marginBottom: -4 }}>
            Day summary
          </span>
          {(() => {
            const totalPrice = transportBookings
              .filter((tb) => tb.confirmed && tb.price)
              .reduce((sum, tb) => sum + Number(tb.price), 0);
            const trainMins = transportBookings
              .filter((tb) => tb.confirmed && tb.departTime && tb.arriveTime)
              .reduce((sum, tb) => {
                const [dh, dm] = tb.departTime.split(":").map(Number);
                const [ah, am] = tb.arriveTime.split(":").map(Number);
                return sum + ((ah * 60 + am) - (dh * 60 + dm));
              }, 0);
            const lastReturn = transportBookings
              .filter((tb) => tb.confirmed && tb.arriveTime)
              .sort((a, b) => b.arriveTime.localeCompare(a.arriveTime))[0];
            return (
              <>
                {trainMins > 0 && (
                  <span>Trains: {Math.floor(trainMins / 60)}h {trainMins % 60}m</span>
                )}
                {totalPrice > 0 && (
                  <span style={{ fontFamily: "var(--display)", fontWeight: 500, color: "var(--gold-2)" }}>
                    Total: {"£"}{totalPrice.toFixed(2)}
                  </span>
                )}
                {firstDepartTime && (
                  <span>First train: {firstDepartTime}</span>
                )}
                {lastReturn && (
                  <span>Arrive back: {lastReturn.arriveTime}</span>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Build my day */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
        <button
          type="button"
          disabled={!canSubmit || pending}
          onClick={submit}
          className="btn btn-gold btn-lg"
        >
          {pending ? "Building your day..." : "Build my day"}
          <Arrow />
        </button>
        {!canSubmit ? (
          <span className="brief-helper" style={{ margin: 0 }}>Every anchor needs a place to continue.</span>
        ) : feasibilityRollup.late > 0 || feasibilityRollup.tight > 0 ? (
          <span className={feasibilityRollup.late > 0 ? "feasibility-flag feasibility-flag-bad" : "feasibility-flag feasibility-flag-tight"}>
            {feasibilityRollup.late > 0 ? `${feasibilityRollup.late} leg${feasibilityRollup.late === 1 ? "" : "s"} arrive${feasibilityRollup.late === 1 ? "s" : ""} late` : `${feasibilityRollup.tight} leg${feasibilityRollup.tight === 1 ? "" : "s"} tight`}
          </span>
        ) : null}
      </div>

      {/* Gmail import modal */}
      {gmailImportOpen ? (
        <BriefGmailImport
          onImport={importParsedBooking}
          onClose={() => setGmailImportOpen(false)}
        />
      ) : null}
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

function BriefGmailImport({
  onImport,
  onClose,
}: {
  onImport: (booking: ParsedBooking) => void;
  onClose: () => void;
}) {
  const [scanning, startScan] = useTransition();
  const [bookings, setBookings] = useState<ParsedBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  const doScan = () => {
    setError(null);
    startScan(async () => {
      const result = await scanGmailForBookings();
      if (!result.ok) {
        setError("Failed to scan Gmail");
        return;
      }
      setBookings(result.value.bookings);
    });
  };

  return (
    <div
      className="booking-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="booking-modal" role="dialog">
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div>
            <span className="uc">Import from Gmail</span>
            <p
              className="brief-helper"
              style={{ margin: "4px 0 0", fontSize: 13 }}
            >
              Scan your inbox for train, flight, and hotel confirmations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: 12, color: "var(--ink-dim)" }}
          >
            Close
          </button>
        </header>

        {!bookings ? (
          <button
            type="button"
            className="btn btn-gold btn-sm"
            onClick={doScan}
            disabled={scanning}
          >
            {scanning ? "Scanning..." : "Scan inbox"}
          </button>
        ) : bookings.length === 0 ? (
          <p className="brief-helper">No booking emails found.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bookings.map((b) => {
              const id = b.gmail_message_id;
              const imported = importedIds.has(id);
              return (
                <div
                  key={id}
                  className="brief-reservation-chip"
                  style={{ opacity: imported ? 0.5 : 1 }}
                >
                  <span style={{ fontWeight: 500, flex: 1 }}>
                    {b.type === "transport"
                      ? (() => {
                          const first = b.segments[0];
                          const last = b.segments[b.segments.length - 1];
                          const modeLabel = b.mode === "train" ? "Train" : b.mode === "flight" ? "Flight" : "Bus";
                          // Round trip: first origin = last destination
                          if (b.segments.length >= 4 && first?.from_station === last?.to_station) {
                            const mid = b.segments[Math.floor(b.segments.length / 2) - 1];
                            return `${modeLabel}: ${first?.from_station ?? ""} to ${mid?.to_station ?? ""} (return)`;
                          }
                          return `${modeLabel}: ${first?.from_station ?? ""} to ${last?.to_station ?? ""}`;
                        })()
                      : `Hotel: ${b.hotel_name}`}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                    {b.type === "transport"
                      ? `${b.segments[0]?.departure_date ?? ""} ${b.segments[0]?.departure_time ?? ""}`
                      : b.check_in_date}
                  </span>
                  {b.booking_reference ? (
                    <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                      ref {b.booking_reference}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={imported}
                    onClick={() => {
                      onImport(b);
                      setImportedIds((prev) => new Set([...prev, id]));
                    }}
                    style={{ marginLeft: "auto", fontSize: 11 }}
                  >
                    {imported ? "Added" : "Add to trip"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error ? (
          <p style={{ color: "var(--rust)", fontSize: 12, marginTop: 8 }}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
