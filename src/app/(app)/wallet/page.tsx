import { requireUserContext } from "@/lib/auth";
import { WalletScreen } from "@/components/wallet/wallet-screen";
import { loadWalletTickets } from "@/lib/actions/wallet";
import { DEMO_TICKETS } from "@/components/concierge/fixtures";
import type { TicketVM } from "@/components/concierge";

// The Wallet (planner master brief §7.5) — a SECONDARY surface, deliberately not
// in the 4-item nav. Reached from Today's document area / a menu. Document-centric
// view of every booked document across trips, grouped by date / ordered by
// time-needed, with offline-capable barcodes.
//
// Real booked documents load via loadWalletTickets (travel_bookings + segments).
// `?demo=1` (staff only) overlays the design fixtures for screenshotting.
export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const ctx = await requireUserContext();
  const sp = await searchParams;
  const demo = ctx.isStaff && sp.demo === "1";

  const tickets: TicketVM[] = demo ? DEMO_TICKETS : await loadWalletTickets();

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
