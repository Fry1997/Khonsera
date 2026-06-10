import type { TicketVM } from "./types";

// Design/wiring fixtures for the booked-document family (§6). Used ONLY by the
// staff-gated Wallet design harness (`/wallet?demo=1`) so Design can elevate
// against a live render, and by future component tests. NEVER rendered on the
// product path — the real Wallet reads booked documents from the data model
// once that layer is wired. Times are relative to "now" so the grouping reads
// as Today / Tomorrow whenever it's viewed.

function at(dayOffset: number, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

export const DEMO_TICKETS: TicketVM[] = [
  // Rail — return booking-pair, Aztec, a tight changeover, a live consequence.
  {
    id: "demo-rail-1",
    kind: "rail",
    operator: "LNER",
    operatorSecondary: "East Midlands Railway",
    reference: "TTBQEBVV",
    price: 8740,
    currency: "GBP",
    source: "forwarded",
    consequence: "This return means you leave the museum by 16:10.",
    legs: [
      {
        id: "demo-rail-1-out",
        origin: { place: "Leicester", code: "LEI", time: at(0, "09:42"), platform: "3" },
        destination: { place: "London St Pancras", code: "STP", time: at(0, "11:01"), platform: "2" },
        durationMinutes: 79,
        coach: "B",
        seat: "42 (window, table)",
        travelClass: "Standard",
        ticketType: "Advance",
        restrictions: "Valid on the 09:42 only",
        changes: [
          { place: "Market Harborough", arrive: at(0, "10:04"), depart: at(0, "10:11"), transferMinutes: 7, platform: "1", tight: true },
        ],
        status: { status: "on_time" },
        barcodes: [
          { format: "aztec", value: "RSP-DEMO-AZTEC-PAYLOAD-ADULT-1", passengerLabel: "Adult 1" },
          { format: "aztec", value: "RSP-DEMO-AZTEC-PAYLOAD-ADULT-2", passengerLabel: "Adult 2" },
        ],
      },
      {
        id: "demo-rail-1-ret",
        origin: { place: "London St Pancras", code: "STP", time: at(0, "17:02"), platform: "4" },
        destination: { place: "Leicester", code: "LEI", time: at(0, "18:09"), platform: "1" },
        durationMinutes: 67,
        coach: "C",
        seat: "11 (aisle)",
        travelClass: "Standard",
        ticketType: "Off-Peak Return",
        status: { status: "delayed", detail: "+12 min" },
        barcodes: [
          { format: "aztec", value: "RSP-DEMO-AZTEC-RET-ADULT-1", passengerLabel: "Adult 1" },
          { format: "aztec", value: "RSP-DEMO-AZTEC-RET-ADULT-2", passengerLabel: "Adult 2" },
        ],
      },
    ],
  },
  // Air — boarding pass, PDF417, a gate change.
  {
    id: "demo-air-1",
    kind: "air",
    operator: "easyJet",
    reference: "K7H2QP",
    price: 6299,
    currency: "GBP",
    source: "inbox",
    legs: [
      {
        id: "demo-air-1-out",
        origin: { place: "London Gatwick", code: "LGW", time: at(1, "07:15"), platform: "B12" },
        destination: { place: "Geneva", code: "GVA", time: at(1, "10:05"), platform: "—" },
        durationMinutes: 110,
        seat: "14C",
        travelClass: "Standard",
        boardingTime: at(1, "06:35"),
        boardingZone: "Zone 2",
        baggage: "1 cabin bag",
        status: { status: "gate_change", detail: "Gate B12 → B27" },
        barcodes: [{ format: "pdf417", value: "M1DEMO/PASSENGER PDF417 PAYLOAD", passengerLabel: "C Fry" }],
      },
    ],
  },
  // Stay — no barcode; check-in is the use-moment.
  {
    id: "demo-stay-1",
    kind: "stay",
    operator: "Premier Inn",
    reference: "PI-99421807",
    price: 9900,
    currency: "GBP",
    source: "manual",
    address: "1 Pentonville Road, London N1 9LZ",
    checkIn: at(1, "15:00"),
    checkOut: at(2, "11:00"),
    roomType: "Double, king",
    nights: 1,
    contact: "+44 20 7000 0000",
    legs: [],
  },
];
