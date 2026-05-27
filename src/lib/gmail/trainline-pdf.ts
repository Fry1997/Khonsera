// Parse text extracted from Trainline eticket PDF attachments.
// Each PDF represents one ticket (one leg of the journey).
// Also extracts Aztec barcode data from PDF images using ZXing WASM.

import type { CallingPoint, ParsedTransportSegment } from "./types";

// NRS station code → full name mapping (common UK stations)
const STATION_NAMES: Record<string, string> = {
  WEL: "Wellingborough",
  LEI: "Leicester",
  DER: "Derby",
  DBY: "Derby",
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
  arrival_time: string;
  date: string;
  ticket_type: string | null;
  route_restriction: string | null;
  operator: string | null;
  coach: string | null;
  seat: string | null;
  price: number | null;
  nrs_ref: string | null;
  barcode_ref: string | null;
  barcode_data: string | null;
  calling_points: CallingPoint[];
};

export function parseTrainlinePdfText(pdfText: string): TrainlinePdfTicket | null {
  // Trainline PDF layout (verified from real data):
  // Line 1: TTBQEBVV49M
  // Line 2: 25 Jun 2026 WEL - LEI
  // Then: WELLINGBOROUGH LEICESTER / WEL LEI
  // Then: TICKET TYPE ROUTE / Advance Single EMR ONLY
  // Then: DEPART 07:13 / COACH * / SEAT ***
  // Then: Itinerary section with intermediate stops + times
  // Then: Ticket Details with price, NRS ref, etc.

  // Header line: "25 Jun 2026 WEL - LEI"
  const headerMatch = pdfText.match(
    /(\d{1,2}\s+\w+\s+\d{4})\s+([A-Z]{3})\s*-\s*([A-Z]{3})/,
  );
  const fromCode = headerMatch?.[2] ?? "";
  const toCode = headerMatch?.[3] ?? "";

  // Date
  let date = "";
  if (headerMatch) {
    const MONTHS: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const parts = headerMatch[1].match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (parts) {
      const day = parts[1].padStart(2, "0");
      const month = MONTHS[parts[2].toLowerCase()] ?? "01";
      date = `${parts[3]}-${month}-${day}`;
    }
  }

  // Departure time: "DEPART\n07:13"
  const departMatch = pdfText.match(/DEPART\n(\d{1,2}:\d{2})/);
  const departureTime = departMatch?.[1] ?? "";

  // Ticket type + route: "Advance Single EMR ONLY" on the line after "TICKET TYPE ROUTE"
  const typeRouteMatch = pdfText.match(
    /TICKET TYPE\s+ROUTE\n(.+?)\n/,
  );
  let ticketType: string | null = null;
  let routeRestriction: string | null = null;
  if (typeRouteMatch) {
    const combined = typeRouteMatch[1].trim();
    const ticketMatch = combined.match(
      /(Advance Single|Advance Return|Off[- ]?Peak (?:Single|Return|Day \w+)|Anytime (?:Single|Return|Day \w+)|Super Off[- ]?Peak \w+)/i,
    );
    ticketType = ticketMatch?.[1] ?? null;
    routeRestriction = ticketType
      ? combined.replace(ticketType, "").trim() || null
      : combined;
  }

  // Coach and seat: "COACH\n*\nSEAT\n***" or "COACH\nB\nSEAT\n42"
  const coachMatch = pdfText.match(/COACH\n([A-Z0-9*]+)/);
  const seatMatch = pdfText.match(/SEAT\n([A-Z0-9*]+)/);
  const coach = coachMatch?.[1] === "*" ? null : coachMatch?.[1] ?? null;
  const seat = seatMatch?.[1]?.includes("*") ? null : seatMatch?.[1] ?? null;

  // Operator from itinerary: "East Midlands\nRailway" (split across lines)
  const operatorMatch = pdfText.match(
    /(East Midlands)\n(Railway)|(Avanti West Coast)|(CrossCountry)|(?:^|\n)(LNER)(?:\n|$)|(Great Western)\n(Railway)|(Northern)|(TransPennine)\n(Express)/,
  );
  let operator: string | null = null;
  if (operatorMatch) {
    const parts = operatorMatch.filter((p, i) => i > 0 && p);
    operator = parts.join(" ");
  }

  // Arrival time + calling points from the itinerary section.
  // The itinerary lists each stop with a time and station name, e.g.:
  //   07:13\nNo specific seat\nWellingborough\n...\n07:45\nKettering\n...\n08:15\nLeicester
  // We extract all (time, station) pairs. First is the departure, last is the
  // arrival, and everything between is a calling point.
  const itinerarySection = pdfText.match(/Itinerary[\s\S]*?(?=Ticket Details)/)?.[0] ?? "";
  const itineraryTimes = [...itinerarySection.matchAll(/(\d{1,2}:\d{2})/g)].map((m) => m[1]);
  const arrivalTime = itineraryTimes.length > 0 ? itineraryTimes[itineraryTimes.length - 1] : "";

  const callingPoints = parseItineraryCallingPoints(itinerarySection, fromCode, toCode);

  // Price: "Price £19.70" (appears as "Price Â£19.70" due to encoding)
  const priceMatch = pdfText.match(/Price\s+(?:Â£|£)([\d.]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : null;

  // NRS Booking Reference
  const nrsMatch = pdfText.match(/NRS Booking Reference\s+([A-Z0-9]+)/);
  const nrsRef = nrsMatch?.[1] ?? null;

  // Barcode reference: first line of PDF or "Ticket Number TTBQEBVV49M"
  const barcodeMatch = pdfText.match(/Ticket Number\s+(TT[A-Z0-9]+)/)
    ?? pdfText.match(/^(TT[A-Z0-9]{8,12})/m);
  const barcodeRef = barcodeMatch?.[1] ?? null;

  // Barcode data is in the Aztec image, not in PDF text
  const barcodeData: string | null = null;

  if (!fromCode && !toCode) return null;

  return {
    from_code: fromCode,
    to_code: toCode,
    from_name: resolveStationName(fromCode) || fromCode,
    to_name: resolveStationName(toCode) || toCode,
    departure_time: departureTime,
    arrival_time: arrivalTime,
    date,
    ticket_type: ticketType,
    route_restriction: routeRestriction,
    operator,
    coach,
    seat,
    price,
    nrs_ref: nrsRef,
    barcode_ref: barcodeRef,
    barcode_data: barcodeData,
    calling_points: callingPoints,
  };
}

// Known operator names that appear in the itinerary section (split across lines).
// These should NOT be treated as station names.
const OPERATOR_NAMES = new Set([
  "east midlands railway",
  "avanti west coast",
  "crosscountry",
  "lner",
  "great western railway",
  "northern",
  "transpennine express",
  "southeastern",
  "southern",
  "thameslink",
  "scotrail",
  "chiltern railways",
  "greater anglia",
  "west midlands trains",
  "c2c",
  "gatwick express",
  "hull trains",
  "grand central",
  "merseyrail",
  "elizabeth line",
  "heathrow express",
]);

const SKIP_LINES = new Set([
  "no specific seat",
  "itinerary",
  "standard class",
  "first class",
  "quiet coach",
  "railway",
  "express",
  "trains",
  "coast",
]);

// Individual words that are part of operator names and should never be
// treated as station names when they appear on their own line.
const OPERATOR_FRAGMENTS = new Set([
  "railway", "express", "trains", "coast",
]);

function parseItineraryCallingPoints(
  itinerarySection: string,
  fromCode: string,
  toCode: string,
): CallingPoint[] {
  if (!itinerarySection) return [];

  const lines = itinerarySection.split("\n").map((l) => l.trim()).filter(Boolean);

  // Build (time, station) pairs by scanning for times followed by station names.
  // Pattern: a line with HH:MM, then skip noise lines (operator, "No specific seat"),
  // until we hit a line that looks like a station name (capitalised, not an operator).
  const stops: { time: string; station: string; code: string | null }[] = [];
  let i = 0;
  while (i < lines.length) {
    const timeMatch = lines[i].match(/^(\d{1,2}:\d{2})$/);
    if (!timeMatch) { i++; continue; }

    const time = timeMatch[1];
    // Look ahead for a station name
    let station: string | null = null;
    let code: string | null = null;
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const line = lines[j];
      if (/^\d{1,2}:\d{2}$/.test(line)) break;
      if (SKIP_LINES.has(line.toLowerCase())) continue;
      // Skip if it's a partial operator name (operators span multiple lines)
      const combined = lines.slice(j, j + 2).join(" ").toLowerCase();
      if (OPERATOR_NAMES.has(combined) || OPERATOR_NAMES.has(line.toLowerCase())) continue;
      // Station names start with a capital letter and are typically 3+ chars
      if (/^[A-Z][a-z]/.test(line) && line.length >= 3) {
        station = line;
        // Check if there's a station code in parentheses or on the next line
        const codeMatch = line.match(/\(([A-Z]{3})\)/);
        if (codeMatch) {
          code = codeMatch[1];
          station = line.replace(/\s*\([A-Z]{3}\)/, "").trim();
        }
        break;
      }
    }
    if (station) {
      // Try to resolve to a CRS code if we don't already have one
      if (!code) {
        const entry = Object.entries(STATION_NAMES).find(
          ([, name]) => name.toLowerCase() === station!.toLowerCase(),
        );
        if (entry) code = entry[0];
      }
      stops.push({ time, station, code });
    }
    i++;
  }

  if (stops.length <= 2) return [];

  // First stop is the departure origin, last is arrival destination — exclude both.
  return stops.slice(1, -1).map((s) => ({
    station: s.station,
    station_code: s.code,
    time: s.time,
  }));
}

// Extract barcode data from .pkpass wallet pass files.
// A .pkpass is a ZIP containing pass.json with barcode info.
export async function extractBarcodeFromPkpass(pkpassBuffer: Buffer): Promise<string | null> {
  try {
    const { Readable } = await import("stream");
    const { createUnzip } = await import("zlib");
    // Minimal ZIP parsing — find pass.json entry and extract it
    const passJson = await extractFileFromZip(pkpassBuffer, "pass.json");
    if (!passJson) return null;
    const pass = JSON.parse(passJson);
    // Apple Wallet pass format
    const barcode = pass.barcodes?.[0] ?? pass.barcode;
    return barcode?.message ?? null;
  } catch {
    return null;
  }
}

async function extractFileFromZip(zipBuf: Buffer, filename: string): Promise<string | null> {
  // Minimal ZIP parsing: find local file headers, locate the target file
  let offset = 0;
  while (offset < zipBuf.length - 4) {
    const sig = zipBuf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // Local file header signature
    const compMethod = zipBuf.readUInt16LE(offset + 8);
    const compSize = zipBuf.readUInt32LE(offset + 18);
    const uncompSize = zipBuf.readUInt32LE(offset + 22);
    const nameLen = zipBuf.readUInt16LE(offset + 26);
    const extraLen = zipBuf.readUInt16LE(offset + 28);
    const name = zipBuf.toString("utf-8", offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;

    if (name === filename) {
      if (compMethod === 0) {
        return zipBuf.toString("utf-8", dataStart, dataStart + uncompSize);
      }
      if (compMethod === 8) {
        const { inflateRawSync } = await import("zlib");
        const compressed = zipBuf.subarray(dataStart, dataStart + compSize);
        return inflateRawSync(compressed).toString("utf-8");
      }
      return null;
    }
    offset = dataStart + compSize;
  }
  return null;
}

// Try to download a .pkpass file from a Trainline download URL.
// The URL format is https://download.thetrainline.com/resource#HASH
// The hash might work as a direct path or query parameter.
export async function tryDownloadPkpass(downloadUrl: string): Promise<Buffer | null> {
  const hashMatch = downloadUrl.match(/#([A-F0-9]{64})/i);
  if (!hashMatch) return null;
  const hash = hashMatch[1];

  const attempts = [
    `https://download.thetrainline.com/resource/${hash}`,
    `https://download.thetrainline.com/resource?token=${hash}`,
  ];

  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        headers: {
          "Accept": "application/vnd.apple.pkpass, application/octet-stream, */*",
          "User-Agent": "Mozilla/5.0",
        },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      // Verify it's a ZIP (PKZip magic bytes)
      if (buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50) {
        return buf;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function decodeAztecFromPdf(pdfBuffer: ArrayBuffer): Promise<string | null> {
  try {
    const { extractImages } = await import("unpdf");
    const images = await extractImages(pdfBuffer, 1);
    if (!images || images.length === 0) return null;

    const { readBarcodes } = await import("zxing-wasm/reader");

    // Try each image — the Aztec code is usually the first/largest
    for (const img of images) {
      // Convert to RGBA ImageData format that zxing-wasm expects
      let rgbaData: Uint8ClampedArray;
      if (img.channels === 4) {
        rgbaData = img.data;
      } else if (img.channels === 3) {
        rgbaData = new Uint8ClampedArray(img.width * img.height * 4);
        for (let i = 0; i < img.width * img.height; i++) {
          rgbaData[i * 4] = img.data[i * 3];
          rgbaData[i * 4 + 1] = img.data[i * 3 + 1];
          rgbaData[i * 4 + 2] = img.data[i * 3 + 2];
          rgbaData[i * 4 + 3] = 255;
        }
      } else if (img.channels === 1) {
        rgbaData = new Uint8ClampedArray(img.width * img.height * 4);
        for (let i = 0; i < img.width * img.height; i++) {
          rgbaData[i * 4] = img.data[i];
          rgbaData[i * 4 + 1] = img.data[i];
          rgbaData[i * 4 + 2] = img.data[i];
          rgbaData[i * 4 + 3] = 255;
        }
      } else {
        continue;
      }

      // ImageData isn't available in Node.js/serverless — pass a plain
      // object with the same shape. ZXing accepts this via its ImageData overload.
      const results = await readBarcodes(
        { data: rgbaData, width: img.width, height: img.height } as ImageData,
        { formats: ["Aztec"], maxNumberOfSymbols: 1 },
      );

      if (results.length > 0 && results[0].text) {
        return results[0].text;
      }
    }
    return null;
  } catch (e) {
    console.warn("Aztec barcode decoding failed", e);
    return null;
  }
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
    arrival_time: t.arrival_time || "",
    service_number: null,
    operator: t.operator,
    route_restriction: t.route_restriction,
    ticket_type: t.ticket_type,
    platform_dep: null,
    platform_arr: null,
    coach: t.coach,
    seat: t.seat,
    barcode_ref: t.barcode_ref,
    barcode_data: t.barcode_data,
    calling_points: t.calling_points.length > 0 ? t.calling_points : null,
  }));
}
