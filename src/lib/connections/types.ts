// Connections framework (Phase 14) — the reusable supplier pattern shared by every
// bookable connection (flight, stay, parking, lounge, rail). One vocabulary —
// Offer → Quote → Booking — that all connectors speak, so the surface compares and
// books the same way regardless of provider, and a mock swaps for a real adapter
// without the caller changing.
//
// The MONEY/irreversible step is the one permitted stub: where a provider is mocked
// (or live-but-test), the booking is real-shaped but no real money moves. Duffel
// Flights is wired LIVE against test mode — the proof the framework holds.

export type ConnectionKind = "flight" | "stay" | "parking" | "lounge" | "fast_track" | "rail";

export type Money = { amount: string; currency: string };

// What you search and compare. `detail` carries kind-specific structure (flight
// segments, a hotel room, …) for the expanded view; `summary` is the one-liner.
export type Offer = {
  id: string; // provider offer id (off_… / rat_… / a mock id)
  kind: ConnectionKind;
  provider: string; // "duffel" | "parkopedia" | "assertis" | …
  title: string; // "British Airways · LHR → JFK"
  price: Money;
  summary: string; // "07:25–10:40 · 1 stop · BA"
  detail?: Record<string, unknown>;
  startIso?: string;
  endIso?: string;
  expiresAt?: string; // offers go stale — re-quote before booking
  sample: boolean; // true = mock or honest "· sample" cue
};

// A locked price, ready to book (Duffel quote / a refreshed offer).
export type Quote = {
  id: string;
  kind: ConnectionKind;
  provider: string;
  price: Money;
  expiresAt?: string;
  sample: boolean;
};

// A confirmed booking — becomes a Ticket / Commitment in the day.
export type Booking = {
  id: string;
  kind: ConnectionKind;
  provider: string;
  reference: string; // PNR / confirmation reference
  price: Money;
  title: string;
  startIso?: string;
  endIso?: string;
  documents?: { type: string; id: string }[]; // e-ticket numbers etc.
  sample: boolean;
};

// Provider availability — drives the honest surface ("live" / "sample" / "coming
// soon, pending activation"). Mirrors the procurement status (D53).
export type ProviderState = "live" | "test" | "mock" | "pending";
export type ProviderInfo = { id: string; kind: ConnectionKind[]; state: ProviderState; note?: string };

// The registry the surface reads to know what it can actually do today. State is
// derived from env at call time (see connectionProviders) — never hardcoded live.
export function connectionProviders(): ProviderInfo[] {
  const duffel = process.env.DUFFEL_API_TOKEN ?? "";
  const duffelState: ProviderState = duffel.startsWith("duffel_live_") ? "live" : duffel ? "test" : "mock";
  return [
    { id: "duffel-flights", kind: ["flight"], state: duffelState, note: duffelState === "test" ? "Duffel test mode — no real charge" : undefined },
    // Stays is sales-gated on the Duffel account; real-shaped, pending activation.
    { id: "duffel-stays", kind: ["stay"], state: duffel ? "pending" : "mock", note: "Duffel Stays pending account activation" },
    { id: "parkopedia", kind: ["parking"], state: process.env.PARKOPEDIA_KEY ? "live" : "mock" },
    { id: "assertis", kind: ["rail"], state: process.env.ASSERTIS_KEY ? "live" : "pending", note: "Rail booking — pending Assertis" },
    { id: "dragonpass", kind: ["lounge", "fast_track"], state: process.env.DRAGONPASS_KEY ? "live" : "mock" },
  ];
}
