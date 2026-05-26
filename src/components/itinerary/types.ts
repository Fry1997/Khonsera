// Shared domain types for the itinerary editor surfaces (brief form +
// the post-submit editor). Pure types only — no React, no helpers, no
// constants. Keep this file dependency-light so both client and server
// modules can pull from it without dragging UI deps along.

import type { PlaceSelection } from "@/components/place-picker";
import type { TransportBookingValue } from "@/components/transport-booking-fields";
import type { AccommodationBookingValue } from "@/components/accommodation-booking-fields";
import type { TicketSegment } from "@/components/train-ticket-card";
import type { GapMode, GapPreview } from "@/components/gap-mode-picker";
import type { ModePreviewMap } from "./transition-row";

// ─────────────────────────────────────────────────────────────────────
// Kinds + sub-roles
//
// Each anchor in the brief carries a kind (the primary badge) and an
// optional role (the sub-badge). Both are inferred from the chosen
// place's Google type but the user can override either at any time.
// ─────────────────────────────────────────────────────────────────────

export type AnchorKind =
  | "appointment"
  | "stay"
  | "meal"
  | "event"
  | "station";

export type AnchorRole = string | null;

export type RoleOption = { value: string; label: string };

// Timing mode — what's pinned on this anchor.
//   arrive_by   — you know when you need to be there. Most common.
//   leave_by    — you know when you need to leave (a train to catch,
//                 a dinner to make). The arrival is derived backwards.
//   around_then — you only know the duration; Khonsera fits the stop
//                 between the adjacent anchors once travel is known.
//   maximize    — spend as long as possible here. Khonsera computes
//                 arrival from inbound transport + travel, departure
//                 from outbound transport - travel - buffer.
export type TimingMode = "arrive_by" | "leave_by" | "around_then" | "maximize";

export type Anchor = {
  uid: string;
  place: PlaceSelection | null;
  kindOverride: AnchorKind | null;
  roleOverride: AnchorRole | null;
  date: string;
  time: string;
  timingMode: TimingMode;
  timingModeOverride: boolean;
  durationMins: number;
  checkOutDate: string;
  checkOutTime: string;
  notes: string | null;
  accommodation: AccommodationBookingValue | null;
};

// ─────────────────────────────────────────────────────────────────────
// Transitions
//
// Each pair of adjacent anchors carries a travel mode. "auto" is a
// legacy sentinel meaning "walk" — it is not selectable in the UI
// and should never be written to new DB rows.
// ─────────────────────────────────────────────────────────────────────

export type TransitionMode =
  | "walk"
  | "drive"
  | "taxi"
  | "bus"
  | "tube"
  | "train"
  | "flight"
  | "mixed";

export type BriefBooking = {
  provider: string;
  reference: string;
  serviceNumber: string;
  departTime: string;
  arriveTime: string;
  seat: string;
  price: string;
  // Station/airport hub for the destination — set via TransportHubPicker
  // when the mode is station-based (train, flight, tube, bus).
  destinationHub: { id: string | null; label: string | null };
};

export type LocalMode = "auto" | "walk" | "drive" | "taxi";

// A Stopover is an *intent* to drop in somewhere between two anchors —
// not an anchor itself. It has no fixed time, only an ideal duration;
// its position is implied by which two anchors it sits between. The
// leave-by times propagate backwards from the next anchor's fixed
// start.
export type Stopover = {
  place: PlaceSelection | null;
  durationMins: number;
};

export type BriefTransition = {
  mode: TransitionMode;
  localBefore: LocalMode;
  localAfter: LocalMode;
  booked: boolean;
  booking: BriefBooking;
  // Rich booking via the full transport modal (same form as planning).
  // When set, takes precedence over the simple `booking` fields.
  transportBooking: TransportBookingValue | null;
};

// ─────────────────────────────────────────────────────────────────────
// Unified Timeline Entry
//
// Both the brief and planning pages build an array of these entries,
// then hand them to the shared <Timeline> component for rendering.
// Each page has its own builder function that closes over page-specific
// state handlers (callbacks).
// ─────────────────────────────────────────────────────────────────────

export type TimelineEntry =
  | {
      kind: "home";
      label: string;
      address?: string;
      leaveBy?: string;
      leaveByDetail?: string;
    }
  | {
      kind: "transport";
      uid: string;
      label: string;
      mode: string;
      legs: TicketSegment[];
      onEdit?: () => void;
      onRemove?: () => void;
    }
  | {
      kind: "anchor";
      uid: string;
      anchor: Anchor;
      earlier: Anchor[];
      expanded: boolean;
      maximizeInfo?: {
        durationMins: number;
        arriveBy: string;
        leaveBy: string;
        travelNote?: string;
      };
      onModeChange?: (next: "expanded" | "summary") => void;
      onChange?: (patch: Partial<Anchor>) => void;
      onRemove?: () => void;
    }
  | {
      kind: "hotel";
      uid: string;
      label: string;
      nights: number;
      checkInTime: string;
      checkOutTime: string;
      reference?: string;
      onEdit?: () => void;
      onRemove?: () => void;
    }
  | {
      kind: "gap-transition";
      from: Anchor | null;
      to: Anchor;
      transition: BriefTransition;
      fromVirtualLabel?: string;
      modePreviews?: ModePreviewMap;
      onChange: (patch: Partial<BriefTransition>) => void;
      onOpenChange?: (open: boolean) => void;
      transitionMeta?: {
        durationMinutes: number | null;
        distanceMiles: number | null;
        feasibility?: { severity: string; message: string } | null;
      };
    }
  | {
      kind: "gap-mode";
      fromLabel: string;
      toLabel: string;
      selected: GapMode | null;
      previews?: Partial<Record<GapMode, GapPreview>>;
      onSelect: (mode: GapMode) => void;
    }
  | {
      kind: "context-gap";
      location: string;
      durationLabel: string;
      onAddStop: () => void;
    }
  | {
      kind: "free-time";
      durationLabel: string;
      beforeLabel: string;
      onAddStop: () => void;
    }
  | {
      kind: "day-break";
      date: string;
      label: string;
    }
  | {
      kind: "home-return";
      arriveBy?: string;
    }
  | {
      kind: "add-stop";
      label: string;
      onAdd: () => void;
    }
  | {
      kind: "inline-adds";
      onAddAnchor: () => void;
      onAddStopover?: () => void;
      onAddTransport?: () => void;
    }
  | {
      kind: "stopover";
      uid: string;
      stopover: Stopover;
      fromAnchor: Anchor;
      toAnchor: Anchor;
      expanded: boolean;
      backCalc?: {
        earliestArrive?: string;
        latestLeave?: string;
        availableMinutes?: number;
        status: "fits" | "tight" | "infeasible" | "unknown";
        message?: string;
      };
      onModeChange?: (next: "expanded" | "summary") => void;
      onChange?: (patch: Partial<Stopover>) => void;
      onRemove?: () => void;
    };
