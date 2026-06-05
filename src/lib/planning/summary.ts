// Itinerary summary aggregate (P4.12) — the TripHeader line + DigestPanel.
//
// "7 stops · 113 mi · 4h 55m · £77", with a cost breakdown when expanded. This
// is the pure aggregate; the server action (`getItinerarySummary`) reads the
// rows (stops, transitions, expenses, booking estimates) and hands them in.
//
// Pure, no IO. Money in pence throughout.

export type CostCategory =
  | "rail"
  | "taxi"
  | "hotel"
  | "parking"
  | "food"
  | "other";

export type CostLine = { category: CostCategory; amountPence: number };

export type SummaryInput = {
  stopCount: number;
  transitions: {
    distanceMiles: number | null;
    durationMinutes: number | null;
  }[];
  costs: CostLine[];
};

export type ItinerarySummary = {
  stopCount: number;
  totalDistanceMi: number;
  totalDurationMin: number;
  totalCostPence: number;
  // Per-category breakdown, highest spend first, zero-categories omitted.
  costBreakdown: CostLine[];
};

export function computeItinerarySummary(
  input: SummaryInput,
): ItinerarySummary {
  const totalDistanceMi = round1(
    input.transitions.reduce((sum, t) => sum + (t.distanceMiles ?? 0), 0),
  );
  const totalDurationMin = input.transitions.reduce(
    (sum, t) => sum + (t.durationMinutes ?? 0),
    0,
  );

  const byCategory = new Map<CostCategory, number>();
  for (const c of input.costs) {
    byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + c.amountPence);
  }
  const costBreakdown: CostLine[] = [...byCategory.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([category, amountPence]) => ({ category, amountPence }))
    .sort((a, b) => b.amountPence - a.amountPence);
  const totalCostPence = costBreakdown.reduce(
    (sum, c) => sum + c.amountPence,
    0,
  );

  return {
    stopCount: input.stopCount,
    totalDistanceMi,
    totalDurationMin,
    totalCostPence,
    costBreakdown,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
