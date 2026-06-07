import { ComparisonMatrix } from "@/components/concierge";
import type { TransportOptionVM } from "@/components/concierge";

// Comparison — the transport decision layer (handover §7). Shows the TWO services
// bracketing the target (latest on-time-or-early; earliest acceptably-late) with
// trade-offs, BEFORE "book?". Options here are illustrative stubs — §17 allows
// mocked/estimated comparison data while the provider layer is wired; "Book" is
// the one transactional stub. This is the placeholder surface Design + the
// decision engine fill in later.

function at(hour: number, min: number): string {
  const d = new Date();
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

const STUB_OPTIONS: TransportOptionVM[] = [
  {
    id: "early",
    mode: "train",
    departure: at(8, 2),
    arrival: at(8, 49),
    deltaMinutes: -11,
    changes: 0,
    cost: 1480,
    currency: "GBP",
  },
  {
    id: "late",
    mode: "train",
    departure: at(8, 17),
    arrival: at(9, 3),
    deltaMinutes: 3,
    changes: 1,
    cost: 990,
    currency: "GBP",
  },
];

export default function ComparePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <header>
        <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
          Decision layer
        </span>
        <h1 className="h1" style={{ marginTop: 6 }}>
          How you get there
        </h1>
        <p className="small" style={{ marginTop: 8, maxWidth: "56ch" }}>
          Two services bracket your target — one that lands you early, one a touch
          later and cheaper. Best fit, not fastest. You choose; Khonsera handles
          the rest.
        </p>
      </header>

      <ComparisonMatrix options={STUB_OPTIONS} />
    </div>
  );
}
