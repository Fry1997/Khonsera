import { requireUserContext } from "@/lib/auth";
import { WalletScreen } from "@/components/wallet/wallet-screen";
import { DEMO_TICKETS } from "@/components/concierge/fixtures";
import type { TicketVM } from "@/components/concierge";

// The Wallet (planner master brief §7.5) — a SECONDARY surface, deliberately not
// in the 4-item nav. Reached from Today's document area / a menu. Document-centric
// view of every booked document across trips.
//
// The booked-document data layer (§6 materialise) is not wired yet, so the
// product path shows the genuine EMPTY state. `?demo=1` (staff only) renders the
// fixtures so Design can elevate the family against a live screenshot — a harness,
// removed once the loader lands.
export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const ctx = await requireUserContext();
  const sp = await searchParams;
  const demo = ctx.isStaff && sp.demo === "1";

  // TODO(wiring §6): load booked documents for ctx.userId + activeMode from the
  // data model and map → TicketVM[]. Until then: empty (product) / fixtures (demo).
  const tickets: TicketVM[] = demo ? DEMO_TICKETS : [];

  return (
    <div className="cc-screen">
      <header>
        <span className="cc-eyebrow">
          {ctx.activeMode === "work" ? "Work" : "Personal"} · Wallet
        </span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          Your tickets
        </h1>
      </header>

      <WalletScreen tickets={tickets} />
    </div>
  );
}
