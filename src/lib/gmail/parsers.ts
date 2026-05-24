// Email HTML parsers for extracting booking data from confirmation emails.
// Each sender has distinctive HTML patterns we match with regex. The parsers
// are deliberately lenient — they extract what they can and leave nulls for
// fields they can't find.

import type {
  ParsedBooking,
  ParsedTransportBooking,
  ParsedTransportSegment,
  ParsedAccommodationBooking,
} from "./types";

// ── Helpers ────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|tr|li|h\d)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findPrice(text: string): { amount: number; currency: "GBP" | "EUR" | "USD" } | null {
  const m =
    text.match(/[£](\d+(?:\.\d{2})?)/) ??
    text.match(/(\d+(?:\.\d{2})?)\s*GBP/) ??
    text.match(/GBP\s*(\d+(?:\.\d{2})?)/) ??
    text.match(/Total[:\s]*[£]?(\d+(?:\.\d{2})?)/i);
  if (m) return { amount: parseFloat(m[1]), currency: "GBP" };

  const eur =
    text.match(/[€](\d+(?:\.\d{2})?)/) ??
    text.match(/(\d+(?:\.\d{2})?)\s*EUR/) ??
    text.match(/EUR\s*(\d+(?:\.\d{2})?)/);
  if (eur) return { amount: parseFloat(eur[1]), currency: "EUR" };

  const usd =
    text.match(/\$(\d+(?:\.\d{2})?)/) ??
    text.match(/(\d+(?:\.\d{2})?)\s*USD/) ??
    text.match(/USD\s*(\d+(?:\.\d{2})?)/);
  if (usd) return { amount: parseFloat(usd[1]), currency: "USD" };

  return null;
}

function isAmendmentEmail(subject: string, text: string): boolean {
  return /amend|changed|updated|modification|revised|new\s*time|rescheduled|altered/i.test(
    subject + " " + text.slice(0, 300),
  );
}

function findBookingRef(text: string): string | null {
  const patterns = [
    /(?:booking\s*(?:ref(?:erence)?|ID|number|#)|confirmation\s*(?:number|#|code)|ref(?:erence)?\s*(?:number|#)?)\s*[:.]?\s*([A-Z0-9][-A-Z0-9]{3,20})/i,
    /\b([A-Z]{2,4}\d{4,10})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

// Parse dates like "Mon 26 May", "26 May 2025", "2025-05-26", "26/05/2025"
const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  january: "01", february: "02", march: "03", april: "04",
  june: "06", july: "07", august: "08", september: "09",
  october: "10", november: "11", december: "12",
};

function parseDate(dateStr: string): string | null {
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const ukMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ukMatch) return `${ukMatch[3]}-${ukMatch[2].padStart(2, "0")}-${ukMatch[1].padStart(2, "0")}`;

  const namedMatch = dateStr.match(
    /(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i,
  );
  if (namedMatch) {
    const day = namedMatch[1].padStart(2, "0");
    const month = MONTHS[namedMatch[2].toLowerCase()];
    const year = namedMatch[3] ?? new Date().getFullYear().toString();
    if (month) return `${year}-${month}-${day}`;
  }

  const namedReversed = dateStr.match(
    /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i,
  );
  if (namedReversed) {
    const month = MONTHS[namedReversed[1].toLowerCase()];
    const day = namedReversed[2].padStart(2, "0");
    const year = namedReversed[3] ?? new Date().getFullYear().toString();
    if (month) return `${year}-${month}-${day}`;
  }

  return null;
}

function parseTime(timeStr: string): string | null {
  const m = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return null;
}

// ── Trainline ──────────────────────────────────────────────────────────

function parseTrainline(html: string, text: string): Partial<ParsedTransportBooking> | null {
  const segments: ParsedTransportSegment[] = [];

  // Trainline typically has patterns like:
  // "London Euston" → "Manchester Piccadilly"
  // "Departs: 14:30" / "Arrives: 16:45"
  const stationPairPattern =
    /(?:from|depart(?:s|ing)?(?:\s+from)?)\s*:?\s*([A-Za-z\s&'.()-]+?)(?:\s+to\s+|\s*→\s*|\s*->\s*|\s*➔\s*)([A-Za-z\s&'.()-]+?)(?:\n|<|,|\s{2})/gi;

  const timeBlockPattern =
    /(\d{1,2}:\d{2})\s*(?:→|->|to|–|-|➔)\s*(\d{1,2}:\d{2})/g;

  const datePattern =
    /(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+)?(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{0,4})/gi;

  const stations: Array<[string, string]> = [];
  let m;
  while ((m = stationPairPattern.exec(text)) !== null) {
    stations.push([m[1].trim(), m[2].trim()]);
  }

  if (stations.length === 0) {
    // Fallback: look for station names on separate lines
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length - 1; i++) {
      if (/depart/i.test(lines[i]) && /arriv/i.test(lines[i + 1])) {
        const from = lines[i].replace(/^.*?:\s*/, "").trim();
        const to = lines[i + 1].replace(/^.*?:\s*/, "").trim();
        if (from.length > 2 && to.length > 2) {
          stations.push([from, to]);
        }
      }
    }
  }

  const times: Array<[string, string]> = [];
  while ((m = timeBlockPattern.exec(text)) !== null) {
    const dep = parseTime(m[1]);
    const arr = parseTime(m[2]);
    if (dep && arr) times.push([dep, arr]);
  }

  const dates: string[] = [];
  while ((m = datePattern.exec(text)) !== null) {
    const d = parseDate(m[1]);
    if (d) dates.push(d);
  }
  const travelDate = dates[0] ?? new Date().toISOString().slice(0, 10);

  const trainNumbers: string[] = [];
  const trainPattern = /(?:train|service)\s*(?:no\.?|number|#)?\s*:?\s*([A-Z0-9]{2,8})/gi;
  while ((m = trainPattern.exec(text)) !== null) {
    trainNumbers.push(m[1]);
  }

  const seatMatch = text.match(
    /(?:seat|coach\s*[&+]?\s*seat)\s*:?\s*(?:coach\s+)?([A-Z0-9]+(?:\s*,?\s*seat\s*\d+[A-Z]?)?)/i,
  );
  const seat = seatMatch ? seatMatch[1].trim() : null;

  const count = Math.max(stations.length, times.length, 1);
  for (let i = 0; i < count; i++) {
    segments.push({
      from_station: stations[i]?.[0] ?? "Unknown",
      to_station: stations[i]?.[1] ?? "Unknown",
      departure_date: travelDate,
      departure_time: times[i]?.[0] ?? "00:00",
      arrival_date: dates[i + 1] ?? travelDate,
      arrival_time: times[i]?.[1] ?? "00:00",
      service_number: trainNumbers[i] ?? null,
      platform_dep: null,
      platform_arr: null,
      seat: i === 0 ? seat : null,
    });
  }

  if (segments.length === 0) return null;

  const price = findPrice(text);
  const ref = findBookingRef(text);

  return {
    type: "transport",
    mode: "train",
    provider: "Trainline",
    booking_reference: ref,
    price: price?.amount ?? null,
    currency: price?.currency ?? "GBP",
    segments,
  };
}

// ── UK Rail operators (LNER, Avanti, GWR, etc.) ────────────────────────

function parseUkRail(
  html: string,
  text: string,
  provider: string,
): Partial<ParsedTransportBooking> | null {
  const segments: ParsedTransportSegment[] = [];

  // UK rail operators typically show journey details in structured blocks
  const journeyPattern =
    /(\d{1,2}:\d{2})\s+([A-Za-z\s&'.()-]+?)\s*(?:→|->|to|–|-|➔|→)\s*(\d{1,2}:\d{2})\s+([A-Za-z\s&'.()-]+?)(?:\n|$)/gm;

  let m;
  const datePattern =
    /(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+)?(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{0,4})/gi;

  const dates: string[] = [];
  while ((m = datePattern.exec(text)) !== null) {
    const d = parseDate(m[1]);
    if (d) dates.push(d);
  }
  const travelDate = dates[0] ?? new Date().toISOString().slice(0, 10);

  while ((m = journeyPattern.exec(text)) !== null) {
    const depTime = parseTime(m[1]);
    const from = m[2].trim();
    const arrTime = parseTime(m[3]);
    const to = m[4].trim();
    if (depTime && arrTime && from.length > 2 && to.length > 2) {
      segments.push({
        from_station: from,
        to_station: to,
        departure_date: travelDate,
        departure_time: depTime,
        arrival_date: travelDate,
        arrival_time: arrTime,
        service_number: null,
        platform_dep: null,
        platform_arr: null,
        seat: null,
      });
    }
  }

  if (segments.length === 0) {
    // Simpler fallback: look for station names and times separately
    const stationNames: string[] = [];
    const stationPattern =
      /(?:from|depart|origin|board\s+at)\s*:?\s*([A-Za-z\s&'.()-]{3,40})/gi;
    while ((m = stationPattern.exec(text)) !== null) {
      stationNames.push(m[1].trim());
    }
    const destPattern =
      /(?:to|arriv(?:e|al|ing)|destination)\s*:?\s*([A-Za-z\s&'.()-]{3,40})/gi;
    const destNames: string[] = [];
    while ((m = destPattern.exec(text)) !== null) {
      destNames.push(m[1].trim());
    }

    const allTimes: string[] = [];
    const allTimesPattern = /\b(\d{1,2}:\d{2})\b/g;
    while ((m = allTimesPattern.exec(text)) !== null) {
      const t = parseTime(m[1]);
      if (t) allTimes.push(t);
    }

    if (stationNames.length > 0 && destNames.length > 0 && allTimes.length >= 2) {
      segments.push({
        from_station: stationNames[0],
        to_station: destNames[0],
        departure_date: travelDate,
        departure_time: allTimes[0],
        arrival_date: travelDate,
        arrival_time: allTimes[1],
        service_number: null,
        platform_dep: null,
        platform_arr: null,
        seat: null,
      });
    }
  }

  if (segments.length === 0) return null;

  const seatMatch = text.match(
    /(?:seat|coach\s*[&+]?\s*seat)\s*:?\s*(?:coach\s+)?([A-Z0-9]+(?:\s*,?\s*seat\s*\d+[A-Z]?)?)/i,
  );
  if (seatMatch && segments[0]) segments[0].seat = seatMatch[1].trim();

  const trainMatch = text.match(
    /(?:train|service)\s*(?:no\.?|number|#)?\s*:?\s*([A-Z0-9]{2,8})/i,
  );
  if (trainMatch && segments[0]) segments[0].service_number = trainMatch[1];

  const price = findPrice(text);
  const ref = findBookingRef(text);

  return {
    type: "transport",
    mode: "train",
    provider,
    booking_reference: ref,
    price: price?.amount ?? null,
    currency: price?.currency ?? "GBP",
    segments,
  };
}

// ── Airlines ───────────────────────────────────────────────────────────

function parseFlightBooking(
  html: string,
  text: string,
  provider: string,
): Partial<ParsedTransportBooking> | null {
  const segments: ParsedTransportSegment[] = [];

  // Look for airport codes (3 uppercase letters)
  const routePattern =
    /([A-Z]{3})\s*(?:→|->|to|–|-|➔)\s*([A-Z]{3})/g;
  const routes: Array<[string, string]> = [];
  let m;
  while ((m = routePattern.exec(text)) !== null) {
    routes.push([m[1], m[2]]);
  }

  // Look for flight numbers
  const flightPattern = /\b([A-Z]{2}\d{1,4})\b/g;
  const flights: string[] = [];
  while ((m = flightPattern.exec(text)) !== null) {
    flights.push(m[1]);
  }

  const datePattern =
    /(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+)?(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{0,4})/gi;
  const dates: string[] = [];
  while ((m = datePattern.exec(text)) !== null) {
    const d = parseDate(m[1]);
    if (d) dates.push(d);
  }
  const travelDate = dates[0] ?? new Date().toISOString().slice(0, 10);

  const allTimes: string[] = [];
  const timePattern = /\b(\d{1,2}:\d{2})\b/g;
  while ((m = timePattern.exec(text)) !== null) {
    const t = parseTime(m[1]);
    if (t) allTimes.push(t);
  }

  const terminalMatch = text.match(
    /(?:terminal|term\.?)\s*:?\s*([A-Z0-9]{1,3})/gi,
  );
  const terminals = terminalMatch
    ? terminalMatch.map((t) => t.replace(/(?:terminal|term\.?)\s*:?\s*/i, "").trim())
    : [];

  const seatMatch = text.match(/(?:seat)\s*:?\s*(\d{1,3}[A-Z])/i);

  const count = Math.max(routes.length, 1);
  for (let i = 0; i < count; i++) {
    segments.push({
      from_station: routes[i]?.[0] ?? "Unknown",
      to_station: routes[i]?.[1] ?? "Unknown",
      departure_date: dates[i] ?? travelDate,
      departure_time: allTimes[i * 2] ?? "00:00",
      arrival_date: dates[i] ?? travelDate,
      arrival_time: allTimes[i * 2 + 1] ?? "00:00",
      service_number: flights[i] ?? null,
      platform_dep: terminals[0] ?? null,
      platform_arr: terminals[1] ?? null,
      seat: i === 0 ? seatMatch?.[1] ?? null : null,
    });
  }

  if (segments.length === 0) return null;

  const price = findPrice(text);
  const ref = findBookingRef(text);

  return {
    type: "transport",
    mode: "flight",
    provider,
    booking_reference: ref,
    price: price?.amount ?? null,
    currency: price?.currency ?? "GBP",
    segments,
  };
}

// ── Accommodation (Booking.com, Hotels.com, etc.) ──────────────────────

function parseAccommodation(
  html: string,
  text: string,
  provider: string,
): Partial<ParsedAccommodationBooking> | null {
  // Hotel name — usually the most prominent heading
  const hotelPatterns = [
    /(?:hotel|property|accommodation)\s*(?:name)?\s*:?\s*([^\n]{3,60})/i,
    /(?:your\s+(?:stay|reservation)\s+(?:at|in))\s+([^\n]{3,60})/i,
    /(?:you'?re\s+(?:staying|booked)\s+at)\s+([^\n]{3,60})/i,
  ];

  let hotelName: string | null = null;
  for (const p of hotelPatterns) {
    const m = text.match(p);
    if (m) {
      hotelName = m[1].trim().replace(/[.,;]+$/, "");
      break;
    }
  }

  // Check-in / check-out dates
  const checkInMatch = text.match(
    /check[\s-]*in\s*:?\s*(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s*,?\s*)?([^\n]{5,30})/i,
  );
  const checkOutMatch = text.match(
    /check[\s-]*out\s*:?\s*(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s*,?\s*)?([^\n]{5,30})/i,
  );

  const checkInDate = checkInMatch ? parseDate(checkInMatch[1]) : null;
  const checkOutDate = checkOutMatch ? parseDate(checkOutMatch[1]) : null;

  if (!checkInDate || !checkOutDate) return null;

  // Check-in/out times
  const checkInTimeMatch = checkInMatch?.[1]
    ? checkInMatch[1].match(/(\d{1,2}:\d{2})/)
    : null;
  const checkOutTimeMatch = checkOutMatch?.[1]
    ? checkOutMatch[1].match(/(\d{1,2}:\d{2})/)
    : null;

  // Also look for "from HH:MM" / "until HH:MM" patterns
  const fromTimeMatch = text.match(
    /check[\s-]*in\s*(?:from|after)\s*:?\s*(\d{1,2}:\d{2})/i,
  );
  const untilTimeMatch = text.match(
    /check[\s-]*out\s*(?:before|by|until)\s*:?\s*(\d{1,2}:\d{2})/i,
  );

  const checkInTime = parseTime(
    checkInTimeMatch?.[1] ?? fromTimeMatch?.[1] ?? "",
  );
  const checkOutTime = parseTime(
    checkOutTimeMatch?.[1] ?? untilTimeMatch?.[1] ?? "",
  );

  // Room type
  const roomMatch = text.match(
    /(?:room\s*(?:type)?|accommodation\s*type)\s*:?\s*([^\n]{3,60})/i,
  );

  const price = findPrice(text);
  const ref = findBookingRef(text);

  return {
    type: "accommodation",
    hotel_name: hotelName ?? "Unknown hotel",
    provider,
    booking_reference: ref,
    check_in_date: checkInDate,
    check_in_time: checkInTime,
    check_out_date: checkOutDate,
    check_out_time: checkOutTime,
    price: price?.amount ?? null,
    currency: price?.currency ?? "GBP",
    room_details: roomMatch ? roomMatch[1].trim() : null,
  };
}

// ── Sender detection ───────────────────────────────────────────────────

type SenderConfig = {
  match: (from: string, subject: string) => boolean;
  parse: (html: string, text: string) => Partial<ParsedBooking> | null;
};

const SENDER_CONFIGS: SenderConfig[] = [
  {
    match: (from) => /trainline/i.test(from),
    parse: (html, text) => parseTrainline(html, text),
  },
  {
    match: (from) => /lner/i.test(from),
    parse: (html, text) => parseUkRail(html, text, "LNER"),
  },
  {
    match: (from) => /avanti\s*west\s*coast/i.test(from),
    parse: (html, text) => parseUkRail(html, text, "Avanti West Coast"),
  },
  {
    match: (from) => /great\s*western|gwr/i.test(from),
    parse: (html, text) => parseUkRail(html, text, "GWR"),
  },
  {
    match: (from) => /crosscountry|cross\s*country/i.test(from),
    parse: (html, text) => parseUkRail(html, text, "CrossCountry"),
  },
  {
    match: (from) => /scotrail/i.test(from),
    parse: (html, text) => parseUkRail(html, text, "ScotRail"),
  },
  {
    match: (from) => /southeastern/i.test(from),
    parse: (html, text) => parseUkRail(html, text, "Southeastern"),
  },
  {
    match: (from) =>
      /british\s*airways|easyjet|ryanair|jet2|tui\s*airways|wizz\s*air|vueling|klm|lufthansa|emirates|virgin\s*atlantic|aer\s*lingus/i.test(
        from,
      ),
    parse: (html, text) => {
      const providerMatch = from.match(
        /british\s*airways|easyjet|ryanair|jet2|tui\s*airways|wizz\s*air|vueling|klm|lufthansa|emirates|virgin\s*atlantic|aer\s*lingus/i,
      );
      return parseFlightBooking(
        html,
        text,
        providerMatch?.[0] ?? "Airline",
      );
    },
  },
  {
    match: (from, subject) =>
      /booking\.com/i.test(from) ||
      /hotels\.com/i.test(from) ||
      /expedia/i.test(from) ||
      /airbnb/i.test(from) ||
      (/confirmation/i.test(subject) && /hotel|stay|accommodation|check[\s-]?in/i.test(subject)),
    parse: (html, text) => {
      const providerMatch = from.match(
        /booking\.com|hotels\.com|expedia|airbnb/i,
      );
      return parseAccommodation(html, text, providerMatch?.[0] ?? "Hotel");
    },
  },
];

let from = ""; // closure var for airline sender config

export function detectAndParse(
  senderEmail: string,
  subject: string,
  html: string | null,
  plainText: string | null,
): Partial<ParsedBooking> | null {
  from = senderEmail;
  const text = plainText ?? (html ? stripHtml(html) : "");
  const htmlContent = html ?? "";

  // Only process confirmation-like or amendment emails
  const isRelevant =
    /confirm|booking|ticket|itinerary|receipt|reservation|e-?ticket|amend|changed|updated|modification|revised|rescheduled/i.test(
      subject,
    ) ||
    /confirm|booking\s*(?:confirm|detail)|your\s*ticket|e-?ticket|reservation/i.test(
      text.slice(0, 500),
    );
  if (!isRelevant) return null;

  const amendment = isAmendmentEmail(subject, text);

  let result: Partial<ParsedBooking> | null = null;

  for (const config of SENDER_CONFIGS) {
    if (config.match(senderEmail, subject)) {
      result = config.parse(htmlContent, text);
      break;
    }
  }

  if (!result) {
    if (/train|rail/i.test(subject)) {
      result = parseUkRail(htmlContent, text, "Rail");
    } else if (/flight|air/i.test(subject)) {
      result = parseFlightBooking(htmlContent, text, "Airline");
    } else if (/hotel|accommodation|stay|check[\s-]?in/i.test(subject)) {
      result = parseAccommodation(htmlContent, text, "Hotel");
    }
  }

  if (result) {
    (result as { is_amendment: boolean }).is_amendment = amendment;
  }

  return result;
}
