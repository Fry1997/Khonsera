"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pass, PassPeek, ScanView } from "@/components/concierge";
import type { TicketVM, BarcodeVM } from "@/components/concierge";
import { ticketUseMoment } from "@/components/concierge";
import { deleteBookedRun } from "@/lib/actions/plan-edit";

// The Wallet (planner master brief §7) — document-centric: every booking across
// trips, grouped by date, ordered within a date by *time-needed* (§7.1). Round 5b
// (Design): the first-class wallet — a stack of issued passes, the next-needed
// full and the day's rest peeking beneath (`.cc-pass--peek`), past collapsed to a
// faint archive. Opens `ScanView` from a pass. Offline-first is wired at
// materialise (§7.3). No new components — Pass/StatusStrip/BarcodePresenter/ScanView.

type Group = { key: string; when?: "today" | "tomorrow"; label: string; tickets: TicketVM[] };

export function WalletScreen({ tickets }: { tickets: TicketVM[] }) {
  const router = useRouter();
  const [scan, setScan] = useState<{ summary: string; barcodes: BarcodeVM[] } | null>(null);

  const { upcoming, archive } = useMemo(() => splitGroups(tickets), [tickets]);

  function remove(t: TicketVM) {
    if (!window.confirm(`Remove the ${t.operator} booking? It clears from your plan too.`)) return;
    void deleteBookedRun(t.id).then((res) => {
      if (res.ok) router.refresh();
    });
  }

  if (tickets.length === 0) {
    return (
      <div className="cc-wallet cc-wallet--lux">
        <div className="cc-wallet-empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mk-ink.png" alt="" />
          <p className="cc-wallet-empty-lead">Your tickets will live here.</p>
          <p className="cc-wallet-empty-sub">
            Every booking, grouped by day, the next one you need on top — and ready
            to scan even without signal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-wallet cc-wallet--lux">
      {upcoming.map((g) => (
        <Stack key={g.key} group={g} onScan={(t) => openScan(t, setScan)} onRemove={remove} />
      ))}

      {archive.length ? (
        <div className="cc-wallet-archive">
          {archive.map((g) => (
            <Stack key={g.key} group={g} onScan={(t) => openScan(t, setScan)} onRemove={remove} />
          ))}
        </div>
      ) : null}

      {scan ? (
        <ScanView summary={scan.summary} barcodes={scan.barcodes} onClose={() => setScan(null)} />
      ) : null}
    </div>
  );
}

function Stack({
  group,
  onScan,
  onRemove,
}: {
  group: Group;
  onScan: (t: TicketVM) => void;
  onRemove: (t: TicketVM) => void;
}) {
  const [hero, ...rest] = group.tickets;
  return (
    <section className="cc-wallet-group" data-when={group.when}>
      <div className="cc-wallet-group-head">{group.label}</div>
      <div className="cc-pass-stack">
        {hero ? (
          <div className="cc-pass-wrap">
            <Pass ticket={hero} onShow={onScan} />
            <button type="button" className="cc-pass-del" onClick={() => onRemove(hero)} aria-label="Remove booking" title="Remove">×</button>
          </div>
        ) : null}
        {rest.map((t) => (
          <div key={t.id} className="cc-pass-wrap">
            <PassPeek ticket={t} onSelect={onScan} />
            <button type="button" className="cc-pass-del" onClick={() => onRemove(t)} aria-label="Remove booking" title="Remove">×</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function openScan(
  t: TicketVM,
  set: (s: { summary: string; barcodes: BarcodeVM[] } | null) => void,
) {
  const leg = t.legs[0];
  if (!leg?.barcodes?.length) return; // stays etc. have no barcode
  const summary = `${t.operator} · ${leg.origin.place} → ${leg.destination.place}`;
  set({ summary, barcodes: leg.barcodes });
}

// Group by calendar day of the use-moment; order chronologically and within a
// group by time-needed. Today / Tomorrow / dated; past → archive.
function splitGroups(tickets: TicketVM[]): { upcoming: Group[]; archive: Group[] } {
  const withMoment = tickets
    .map((t) => ({ t, m: ticketUseMoment(t) }))
    .filter((x): x is { t: TicketVM; m: string } => Boolean(x.m))
    .sort((a, b) => a.m.localeCompare(b.m));

  const todayKey = dayKey(new Date());
  const map = new Map<string, Group>();
  for (const { t, m } of withMoment) {
    const d = new Date(m);
    const key = dayKey(d);
    const g = map.get(key) ?? { key, when: whenFor(d), label: dayLabel(d), tickets: [] };
    g.tickets.push(t);
    map.set(key, g);
  }
  const all = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  return {
    upcoming: all.filter((g) => g.key >= todayKey),
    archive: all.filter((g) => g.key < todayKey).reverse(), // most-recent past first
  };
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function whenFor(d: Date): "today" | "tomorrow" | undefined {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const k = dayKey(d);
  if (k === dayKey(today)) return "today";
  if (k === dayKey(tomorrow)) return "tomorrow";
  return undefined;
}

function dayLabel(d: Date): string {
  const w = whenFor(d);
  if (w === "today") return "Today";
  if (w === "tomorrow") return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(d);
}
