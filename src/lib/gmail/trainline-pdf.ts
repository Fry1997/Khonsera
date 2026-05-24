// Parse text extracted from Trainline eticket PDF attachments.
// Each PDF represents one ticket (one leg of the journey).

import type { ParsedTransportSegment } from "./types";

// NRS station code → full name mapping (common UK stations)
const STATION_NAMES: Record<string, string> = {
  WEL: "Wellingborough",
  LEI: "Leicester",
  DER: "Derby",
  NTG: "Nottingham",
  SHF: "Sheffield",
  LDS: "Leeds",
  MAN: "Manchester Piccadilly",
  MCV: "Manchester Victoria",
  BHM: "Birmingham New Street",
  LIV: "Liverpool Lime Street",
  LBG: "London Bridge",
  KGX: "London Kings Cross",
  STP: "London St Pancras",
  EUS: "London Euston",
  PAD: "London Paddington",
  VIC: "London Victoria",
  WAT: "London Waterloo",
  BRI: "Brighton",
  CBG: "Cambridge",
  OXF: "Oxford",
  YRK: "York",
  NCL: "Newcastle",
  EDB: "Edinburgh Waverley",
  GLC: "Glasgow Central",
  CRE: "Crewe",
  RDG: "Reading",
  BTN: "Brighton",
  BMS: "Bromley South",
  MKC: "Milton Keynes Central",
  KET: "Kettering",
  COV: "Coventry",
  PMH: "Portsmouth Harbour",
  SOT: "Southampton Central",
  BHI: "Bournemouth",
  EXD: "Exeter St Davids",
  PLY: "Plymouth",
  TBD: "Taunton",
  SWA: "Swansea",
  CDF: "Cardiff Central",
  BPW: "Bristol Parkway",
  BTH: "Bath Spa",
};

export function resolveStationName(code: string): string {
  return STATION_NAMES[code] ?? code;
}

export type TrainlinePdfTicket = {
  from_code: string;
  to_code: string;
  from_name: string;
  to_name: string;
  departure_time: string;
  date: string;
  ticket_type: string | null;
  route_restriction: string | null;
  operator: string | null;
  coach: string | null;
  seat: string | null;
  barcode_ref: string | null;
};

export function parseTrainlinePdfText(pdfText: string): TrainlinePdfTicket | null {
  // Trainline eticket PDFs have a consistent layout:
  // Station codes (WEL, LEI), times, ticket type, route, coach/seat

  // Station codes: 3-letter NRS codes, usually near top
  const codePattern = /\b([A-Z]{3})\s*[-–→]\s*([A-Z]{3})\b/;
  const codeMatch = pdfText.match(codePattern);

  // Also try separate patterns: "WELLINGBOROUGH" header + "WEL" code
  const fromCodeMatch = pdfText.match(/\b([A-Z]{3})\b[\s\S]{0,50}→|^([A-Z]{3})\s/m);
  const toCodeMatch = pdfText.match(/→[\s\S]{0,50}\b([A-Z]{3})\b|→\s*([A-Z]{3})/);

  let fromCode = codeMatch?.[1] ?? fromCodeMatch?.[1] ?? fromCodeMatch?.[2] ?? "";
  let toCode = codeMatch?.[2] ?? toCodeMatch?.[1] ?? toCodeMatch?.[2] ?? "";

  // Station names: look for UPPERCASE station names
  const stationNamePattern = /([A-Z][A-Z\s]+(?:STREET|ROAD|CENTRAL|PARKWAY|LIME|CROSS|BRIDGE)?)\s/g;
  const stationNames: string[] = [];
  let m;
  while ((m = stationNamePattern.exec(pdfText)) !== null) {
    const name = m[1].trim();
    if (name.length > 3 && !/TICKET|TYPE|ROUTE|ADULT|CHILD|DEPART|RESERV|SINGLE|RETURN|ADVANCE|OFF.PEAK/i.test(name)) {
      stationNames.push(name);
    }
  }

  // Time: departure time
  const timeMatch = pdfText.match(/(?:DEPART|DEP|Depart)\s*:?\s*(\d{1,2}:\d{2})/i)
    ?? pdfText.match(/\b(\d{1,2}:\d{2})\b/);
  const departureTime = timeMatch?.[1] ?? "";

  // Date
  const dateMatch = pdfText.match(
    /(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{0,4})/i,
  );
  let date = "";
  if (dateMatch) {
    const MONTHS: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
      january: "01", february: "02", march: "03", april: "04",
      june: "06", july: "07", august: "08", september: "09",
      october: "10", november: "11", december: "12",
    };
    const parts = dateMatch[1].match(/(\d{1,2})\s+(\w+)\s*(\d{4})?/);
    if (parts) {
      const day = parts[1].padStart(2, "0");
      const month = MONTHS[parts[2].toLowerCase()] ?? "01";
      const year = parts[3] ?? new Date().getFullYear().toString();
      date = `${year}-${month}-${day}`;
    }
  }

  // Ticket type: "Advance Single", "Off-Peak Return", etc.
  const ticketTypeMatch = pdfText.match(
    /(?:TICKET\s*TYPE|Ticket\s*Type)\s*:?\s*(.+?)(?:\n|$)/i,
  ) ?? pdfText.match(
    /((?:Advance|Off[- ]?Peak|Anytime|Super Off[- ]?Peak)\s+(?:Single|Return|Day Single|Day Return))/i,
  );
  const ticketType = ticketTypeMatch?.[1]?.trim() ?? null;

  // Route restriction: "Emr Only", "Any Permitted", etc.
  const routeMatch = pdfText.match(
    /(?:ROUTE|Route)\s*:?\s*(.+?)(?:\n|$)/i,
  );
  const routeRestriction = routeMatch?.[1]?.trim() ?? null;

  // Operator
  const operatorMatch = pdfText.match(
    /(East Midlands Railway|Avanti West Coast|LNER|CrossCountry|Great Western Railway|Northern|TransPennine Express|South(?:ern|western)|Southeastern|ScotRail|Chiltern|c2c|Greater Anglia|Thameslink|West Midlands Railway)/i,
  );
  const operator = operatorMatch?.[1] ?? null;

  // Coach and seat: "Coach B Seat 42" or "COACH: B  SEAT: 42"
  const coachMatch = pdfText.match(/(?:COACH|Coach)\s*:?\s*([A-Z0-9]{1,3})/i);
  const seatMatch = pdfText.match(/(?:SEAT|Seat)\s*:?\s*(\d{1,3}[A-Z]?)/i);
  const coach = coachMatch?.[1] ?? null;
  const seat = seatMatch?.[1] ?? null;

  // Barcode reference: alphanumeric string near bottom, often 10-12 chars
  const barcodeMatch = pdfText.match(/\b([A-Z0-9]{10,14})\b(?:\s*$)/m)
    ?? pdfText.match(/\b(TT[A-Z0-9]{8,12})\b/);
  const barcodeRef = barcodeMatch?.[1] ?? null;

  if (!fromCode && !toCode && stationNames.length < 2) return null;

  return {
    from_code: fromCode,
    to_code: toCode,
    from_name: resolveStationName(fromCode) || stationNames[0] || fromCode,
    to_name: resolveStationName(toCode) || stationNames[1] || toCode,
    departure_time: departureTime,
    date,
    ticket_type: ticketType,
    route_restriction: routeRestriction,
    operator,
    coach,
    seat,
    barcode_ref: barcodeRef,
  };
}

export function pdfTicketsToSegments(
  tickets: TrainlinePdfTicket[],
  fallbackDate: string,
): ParsedTransportSegment[] {
  return tickets.map((t) => ({
    from_station: t.from_name,
    to_station: t.to_name,
    from_station_code: t.from_code || null,
    to_station_code: t.to_code || null,
    departure_date: t.date || fallbackDate,
    departure_time: t.departure_time || "00:00",
    arrival_date: t.date || fallbackDate,
    arrival_time: "",
    service_number: null,
    operator: t.operator,
    route_restriction: t.route_restriction,
    ticket_type: t.ticket_type,
    platform_dep: null,
    platform_arr: null,
    coach: t.coach,
    seat: t.seat,
    barcode_ref: t.barcode_ref,
  }));
}
