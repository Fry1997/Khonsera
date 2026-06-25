// Parse text extracted from Trainline eticket PDF attachments.
// Each PDF represents one ticket (one leg of the journey).
// Also extracts Aztec barcode data from PDF images using ZXing WASM.

import type { ParsedTransportSegment } from "./types";

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
  HPD: "Harpenden",
  LUT: "Luton",
  BDM: "Bedford",
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

  // Station code pair. Two known Trainline layouts:
  //   "25 Jun 2026 WEL - LEI"            (Advance/seated tickets)
  //   "11 Jun 2026 Out: WEL - HPD"       (Anytime Day Return etickets)
  //   "11 Jun 2026 Ret: HPD - WEL"
  // So find the first CODE - CODE pair (optionally behind Out:/Ret:) where both
  // sides are plausible 3-letter CRS codes, rather than anchoring on the date.
  let fromCode = "";
  let toCode = "";
  for (const m of pdfText.matchAll(/(?:Out|Ret(?:urn)?|Outbound|Inbound)?\s*:?\s*\b([A-Z]{3})\b\s*[-–]\s*\b([A-Z]{3})\b/g)) {
    const a = m[1];
    const b = m[2];
    // Reject obvious non-stations (e.g. "ANY", "PER" from "ANY PERMITTED").
    if (a === b) continue;
    if (/^(ANY|PER|AND|THE|FOR|ADU|TIC)$/.test(a) || /^(ANY|PER|AND|THE|FOR|ADU|TIC)$/.test(b)) continue;
    fromCode = a;
    toCode = b;
    break;
  }

  // Date — found anywhere ("11 Jun 2026"), independent of the code pair.
  let date = "";
  const dateMatch = pdfText.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (dateMatch) {
    const MONTHS: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const day = dateMatch[1].padStart(2, "0");
    const month = MONTHS[dateMatch[2].slice(0, 3).toLowerCase()] ?? "01";
    date = `${dateMatch[3]}-${month}-${day}`;
  }

  // Times come from the Itinerary section (first = departure, last = arrival).
  // Some eticket layouts (e.g. flexible/Off-Peak tickets) omit the "DEPART\n07:13"
  // header that Advance tickets carry, so anchoring departure ONLY on DEPART left
  // those tickets at 00:00. Fall back to the itinerary's first time.
  const itinerarySection = pdfText.match(/Itinerary[\s\S]*?(?=Ticket Details)/)?.[0] ?? "";
  const itineraryTimes = [...itinerarySection.matchAll(/(\d{1,2}:\d{2})/g)].map((m) => m[1]);

  // Departure time: "DEPART\n07:13", else the first itinerary time.
  const departMatch = pdfText.match(/DEPART\n(\d{1,2}:\d{2})/);
  const departureTime = departMatch?.[1] ?? itineraryTimes[0] ?? "";

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

  // Arrival time: last time in the itinerary section (computed above).
  const arrivalTime = itineraryTimes.length > 0 ? itineraryTimes[itineraryTimes.length - 1] : "";

  // Price: "Price £19.70" (appears as "Price Â£19.70" due to encoding)
  const priceMatch = pdfText.match(/Price\s+(?:Â£|£)([\d.]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : null;

  // NRS Booking Reference. Require a real ref length so a literal "N/A" (the regex
  // would otherwise capture just "N", stopping at the slash) becomes null instead
  // of polluting the booking reference.
  const nrsMatch = pdfText.match(/NRS Booking Reference\s+([A-Z0-9]{4,})/);
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
  };
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
  }));
}
