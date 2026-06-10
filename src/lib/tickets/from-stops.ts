import type {
  TicketVM,
  TicketLegVM,
  TicketChange,
  BarcodeVM,
  DocumentKind,
  BarcodeFormat,
} from "@/components/concierge";

// Read booked travel documents from STOP METADATA (functional-integrity review).
// Real bookings (e.g. the Gmail/Trainline import) are stored as a contiguous run
// of stops — transit_departure → transit_changeover(s) → transit_arrival — each
// carrying operator / reference / barcode_data on `metadata`. This folds each run
// into one TicketVM the document family renders (Wallet, the docked Pass, ScanView),
// so the user's real tickets + Aztec barcodes reappear. No migration.

export type TransitStop = {
  id: string;
  type: string;
  title: string | null;
  start_time: string | null;
  metadata: Record<string, unknown> | null;
};

export type FoldedTicket = {
  ticket: TicketVM;
  departureStopId: string;
  arrivalStopId: string;
  stopIds: string[]; // every stop in the run (for collapsing the spine)
};

function s(meta: Record<string, unknown> | null, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === "string" && v.length ? v : undefined;
}

function modeToKind(mode?: string): DocumentKind {
  if (!mode) return "rail";
  if (/(flight|plane|air)/i.test(mode)) return "air";
  if (/(bus|coach|ferry)/i.test(mode)) return "ground";
  return "rail";
}

function kindToFormat(kind: DocumentKind): BarcodeFormat {
  return kind === "air" ? "pdf417" : "aztec";
}

// Walk a single itinerary's ordered stops, folding each transit run into a ticket.
export function foldStopsToTickets(stops: TransitStop[]): FoldedTicket[] {
  const out: FoldedTicket[] = [];
  let i = 0;
  while (i < stops.length) {
    if (stops[i].type !== "transit_departure") {
      i += 1;
      continue;
    }
    const dep = stops[i];
    const run: TransitStop[] = [dep];
    let j = i + 1;
    while (j < stops.length && stops[j].type === "transit_changeover") {
      run.push(stops[j]);
      j += 1;
    }
    // The arrival closes the run (if present).
    let arr: TransitStop | null = null;
    if (j < stops.length && stops[j].type === "transit_arrival") {
      arr = stops[j];
      run.push(stops[j]);
      j += 1;
    }
    out.push(buildTicket(dep, run.filter((r) => r.type === "transit_changeover"), arr, run));
    i = j;
  }
  return out;
}

function buildTicket(
  dep: TransitStop,
  changeovers: TransitStop[],
  arr: TransitStop | null,
  run: TransitStop[],
): FoldedTicket {
  const kind = modeToKind(s(dep.metadata, "transport_mode"));
  const format = kindToFormat(kind);

  const changes: TicketChange[] = changeovers.map((c) => ({
    place: c.title ?? "Change",
    arrive: c.start_time ?? undefined,
    depart: c.start_time ?? undefined,
  }));

  // One barcode per boarded leg (departure + each changeover carries one).
  const barcodes: BarcodeVM[] = [dep, ...changeovers]
    .map((st, idx) => {
      const data = s(st.metadata, "barcode_data");
      if (!data) return null;
      return {
        format,
        value: data,
        passengerLabel: s(st.metadata, "barcode_ref") ?? `Leg ${idx + 1}`,
      } as BarcodeVM;
    })
    .filter((b): b is BarcodeVM => b !== null);

  const priceStr = s(dep.metadata, "price");
  const price = priceStr ? Math.round(parseFloat(priceStr) * 100) : undefined;

  const leg: TicketLegVM = {
    id: `${dep.id}-leg`,
    origin: { place: dep.title ?? "Departure", time: dep.start_time ?? undefined },
    destination: { place: arr?.title ?? "Arrival", time: arr?.start_time ?? undefined },
    durationMinutes:
      dep.start_time && arr?.start_time
        ? Math.round((new Date(arr.start_time).getTime() - new Date(dep.start_time).getTime()) / 60000)
        : undefined,
    changes: changes.length ? changes : undefined,
    seat: s(dep.metadata, "seat"),
    ticketType: s(dep.metadata, "ticket_type"),
    restrictions: s(dep.metadata, "route_restriction"),
    barcodes: barcodes.length ? barcodes : undefined,
    status: { status: "on_time" },
  };

  const ticket: TicketVM = {
    id: dep.id,
    kind,
    operator: s(dep.metadata, "operator") ?? "Train",
    reference: s(dep.metadata, "booking_reference"),
    price,
    currency: "GBP",
    source: "forwarded",
    legs: [leg],
  };

  return {
    ticket,
    departureStopId: dep.id,
    arrivalStopId: (arr ?? changeovers[changeovers.length - 1] ?? dep).id,
    stopIds: run.map((r) => r.id),
  };
}
