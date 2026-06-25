"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { err, errors, ok, type Result } from "@/lib/errors";
import { getValidGmailAccessToken } from "@/lib/google/gmail-client";
import {
  gmailSearchMessages,
  gmailGetMessage,
  gmailGetAttachment,
  getHeader,
  extractMessageBody,
  extractAttachments,
} from "@/lib/google/gmail";
import { detectAndParse, stripHtmlPublic } from "@/lib/gmail/parsers";
import { type ParsedBooking, getTravelDate } from "@/lib/gmail/types";
import { deduplicateTrainlineBookings } from "@/lib/gmail/dedup";
import {
  parseTrainlinePdfText,
  pdfTicketsToSegments,
  decodeAztecFromPdf,
  tryDownloadPkpass,
  extractBarcodeFromPkpass,
} from "@/lib/gmail/trainline-pdf";
import {
  parseRailsmartrPdfText,
  railsmartrTicketsToSegments,
} from "@/lib/gmail/railsmartr-pdf";
import { parseStructuredFromHtml, extractJsonLd } from "@/lib/gmail/structured-parser";

const BOOKING_SENDERS = [
  "trainline",
  "railsmartr",
  "lner",
  "avanti",
  "gwr",
  "crosscountry",
  "scotrail",
  "southeastern",
  "british airways",
  "easyjet",
  "ryanair",
  "jet2",
  "booking.com",
  "hotels.com",
  "expedia",
  "airbnb",
  "tui",
  "wizz air",
  "vueling",
  "klm",
  "lufthansa",
  "emirates",
  "virgin atlantic",
];

async function enrichTrainlineFromPdfs(
  accessToken: string,
  messageId: string,
  msg: Awaited<ReturnType<typeof gmailGetMessage>>,
  parsed: Partial<ParsedBooking>,
): Promise<Partial<ParsedBooking>> {
  const attachments = extractAttachments(msg);
  const pdfs = attachments.filter(
    (a) => a.mimeType === "application/pdf" || a.filename?.endsWith(".pdf"),
  );
  if (pdfs.length === 0) return parsed;
  if (parsed.type !== "transport") return parsed;

  // Fetch all PDF buffers first (needed for both text + barcode extraction)
  const pdfBuffers = await Promise.all(
    pdfs.map(async (pdf) => {
      try {
        return await gmailGetAttachment({
          accessToken, messageId, attachmentId: pdf.attachmentId,
        });
      } catch {
        return null;
      }
    }),
  );

  const { extractText } = await import("unpdf").catch(() => ({ extractText: null }));
  if (!extractText) return parsed;

  // Parse text AND decode the Aztec for each PDF, keeping them aligned to their
  // buffer (the previous code filtered nulls first, then decoded by index — so a
  // single unparseable PDF mis-attached every barcode). One ticket per PDF; for a
  // return booking that's the outbound eticket + the return eticket, each with its
  // own Aztec.
  const perPdf = await Promise.all(
    pdfBuffers.map(async (buf) => {
      if (!buf) return null;
      let ticket: ReturnType<typeof parseTrainlinePdfText> = null;
      try {
        // FRESH buffer per consumer: unpdf/pdf.js TRANSFERS (detaches) the
        // ArrayBuffer when it reads the text, so a shared buffer leaves the
        // Aztec decode with zero bytes (silently no barcode). Give each its own.
        const result = await extractText(new Uint8Array(buf).buffer);
        const pdfText = Array.isArray(result.text) ? result.text.join("\n") : result.text;
        ticket = parseTrainlinePdfText(pdfText);
      } catch {
        // text extraction failed
      }
      if (!ticket) return null;
      try {
        const barcodeData = await decodeAztecFromPdf(new Uint8Array(buf).buffer);
        if (barcodeData) ticket.barcode_data = barcodeData;
      } catch {
        // Barcode decoding is best-effort — the ticket detail still imports.
      }
      return ticket;
    }),
  );

  const validTickets = perPdf.filter((t): t is NonNullable<typeof t> => t !== null);
  if (validTickets.length === 0) return parsed;

  const fallbackDate = parsed.segments?.[0]?.departure_date ?? new Date().toISOString().slice(0, 10);
  const pdfSegments = pdfTicketsToSegments(validTickets, fallbackDate);

  // If existing segments have departure times from the booking confirmation
  // subject, merge those times onto matching PDF segments
  const existingSegments = parsed.segments ?? [];
  if (existingSegments.length > 0 && pdfSegments.length > 0) {
    for (const existing of existingSegments) {
      if (!existing.departure_time || existing.departure_time === "00:00") continue;
      const match = pdfSegments.find(
        (ps) =>
          ps.from_station.toLowerCase().includes(existing.from_station.toLowerCase()) ||
          (ps.from_station_code && existing.from_station.toLowerCase().includes(ps.from_station_code.toLowerCase())),
      );
      if (match && (!match.departure_time || match.departure_time === "00:00")) {
        match.departure_time = existing.departure_time;
      }
    }
  }

  // Sum per-ticket prices from PDFs
  const totalPrice = validTickets.reduce((sum, t) => sum + (t.price ?? 0), 0);
  const nrsRef = validTickets.find((t) => t.nrs_ref)?.nrs_ref;

  return {
    ...parsed,
    segments: pdfSegments.length >= existingSegments.length ? pdfSegments : existingSegments,
    price: totalPrice > 0 ? totalPrice : (parsed as { price?: number | null }).price ?? null,
    booking_reference: nrsRef ?? (parsed as { booking_reference?: string | null }).booking_reference ?? null,
  };
}

// RailSmartr (Assertis) carries the whole journey in its PDF eTickets, not the
// body. Parse each PDF's text → itinerary legs, decode its Aztec, then combine the
// outbound + return halves into one booking. Mirrors enrichTrainlineFromPdfs but
// for the inline-labelled Assertis layout (and the return-fare price rule).
async function enrichRailsmartrFromPdfs(
  accessToken: string,
  messageId: string,
  msg: Awaited<ReturnType<typeof gmailGetMessage>>,
  parsed: Partial<ParsedBooking>,
): Promise<Partial<ParsedBooking>> {
  if (parsed.type !== "transport") return parsed;
  const attachments = extractAttachments(msg);
  const pdfs = attachments.filter(
    (a) => a.mimeType === "application/pdf" || a.filename?.endsWith(".pdf"),
  );
  if (pdfs.length === 0) return parsed;

  const pdfBuffers = await Promise.all(
    pdfs.map(async (pdf) => {
      try {
        return await gmailGetAttachment({ accessToken, messageId, attachmentId: pdf.attachmentId });
      } catch {
        return null;
      }
    }),
  );

  const { extractText } = await import("unpdf").catch(() => ({ extractText: null }));
  if (!extractText) return parsed;

  const tickets = await Promise.all(
    pdfBuffers.map(async (buf) => {
      if (!buf) return null;
      let ticket: ReturnType<typeof parseRailsmartrPdfText> = null;
      try {
        // Fresh buffer per consumer — unpdf detaches the ArrayBuffer on read.
        const result = await extractText(new Uint8Array(buf).buffer);
        const pdfText = Array.isArray(result.text) ? result.text.join(" ") : result.text;
        ticket = parseRailsmartrPdfText(pdfText);
      } catch {
        // text extraction failed
      }
      if (!ticket) return null;
      try {
        const barcodeData = await decodeAztecFromPdf(new Uint8Array(buf).buffer);
        if (barcodeData) ticket.barcode_data = barcodeData;
      } catch {
        // Aztec decode is best-effort; the ticket detail still imports.
      }
      return ticket;
    }),
  );

  const valid = tickets.filter((t): t is NonNullable<typeof t> => t !== null);
  if (valid.length === 0) return parsed;

  const fallbackDate = parsed.segments?.[0]?.departure_date ?? new Date().toISOString().slice(0, 10);
  const segments = railsmartrTicketsToSegments(valid, fallbackDate).sort((a, b) =>
    (a.departure_date + a.departure_time).localeCompare(b.departure_date + b.departure_time),
  );

  // Price: an Anytime Day RETURN prints the SAME fare on both halves — count each
  // distinct ticket number's price ONCE (summing would double the return). Two
  // genuinely separate tickets (distinct numbers) still sum correctly.
  const priceByTicket = new Map<string, number>();
  valid.forEach((t, i) => {
    if (t.price != null) priceByTicket.set(t.ticket_number ?? `__${i}`, t.price);
  });
  const totalPrice = [...priceByTicket.values()].reduce((s, p) => s + p, 0);

  const ref = valid.find((t) => t.ticket_number)?.ticket_number ?? null;

  return {
    ...parsed,
    provider: "Railsmartr",
    segments,
    price: totalPrice > 0 ? totalPrice : (parsed as { price?: number | null }).price ?? null,
    booking_reference: ref ?? (parsed as { booking_reference?: string | null }).booking_reference ?? null,
  };
}

// Large emails (a Trainline confirmation is ~150KB) return their text/html via a
// `body.attachmentId` rather than inline `body.data` — so extractMessageBody yields
// EMPTY html and the JSON-LD never reaches the structured parser. Find the html
// attachment part so we can fetch it on demand.
type MsgPart = { mimeType?: string; body?: { data?: string; attachmentId?: string }; parts?: MsgPart[] };
function findHtmlAttachmentId(part: MsgPart | undefined): string | null {
  if (!part) return null;
  if (part.mimeType === "text/html" && part.body?.attachmentId && !part.body?.data) {
    return part.body.attachmentId;
  }
  for (const child of part.parts ?? []) {
    const id = findHtmlAttachmentId(child);
    if (id) return id;
  }
  return null;
}

// Brand name from the sender, so the structured parser tags the booking right.
function providerHintFromSender(from: string): string | null {
  const f = from.toLowerCase();
  if (/trainline/.test(f)) return "Trainline";
  if (/railsmartr|assertis/.test(f)) return "RailSmartr";
  if (/\blner\b/.test(f)) return "LNER";
  if (/avanti/.test(f)) return "Avanti West Coast";
  if (/\bgwr\b|great\s*western/.test(f)) return "GWR";
  if (/crosscountry|cross\s*country/.test(f)) return "CrossCountry";
  if (/scotrail/.test(f)) return "ScotRail";
  if (/southeastern/.test(f)) return "Southeastern";
  return null;
}

// Structured bookings carry the correct journey but no Aztec (a barcode is an
// image, not JSON-LD). Graft the scannable barcodes from any PDF e-tickets onto
// the matching boarding leg — reusing the proven PDF text + Aztec decoders.
// Best-effort: failures never break the import.
async function graftBarcodesFromPdfs(
  accessToken: string,
  messageId: string,
  msg: Awaited<ReturnType<typeof gmailGetMessage>>,
  bookings: ParsedBooking[],
): Promise<void> {
  const transport = bookings.filter((b): b is Extract<ParsedBooking, { type: "transport" }> => b.type === "transport");
  if (!transport.length) return;
  const pdfs = extractAttachments(msg).filter(
    (a) => a.mimeType === "application/pdf" || a.filename?.endsWith(".pdf"),
  );
  if (!pdfs.length) return;
  const { extractText } = await import("unpdf").catch(() => ({ extractText: null }));
  if (!extractText) return;

  for (const pdf of pdfs) {
    let buf: Awaited<ReturnType<typeof gmailGetAttachment>> | null = null;
    try {
      buf = await gmailGetAttachment({ accessToken, messageId, attachmentId: pdf.attachmentId });
    } catch {
      continue;
    }
    if (!buf) continue;
    let originCode = "";
    let originName = "";
    try {
      const result = await extractText(new Uint8Array(buf).buffer);
      const pdfText = Array.isArray(result.text) ? result.text.join("\n") : result.text;
      const ticket = parseTrainlinePdfText(pdfText);
      originCode = ticket?.from_code ?? "";
      originName = ticket?.from_name ?? "";
    } catch {
      // origin unknown — we'll fall back to the first un-barcoded leg
    }
    let barcode: string | null = null;
    try {
      barcode = await decodeAztecFromPdf(new Uint8Array(buf).buffer);
    } catch {
      // no barcode in this PDF
    }
    if (!barcode) continue;
    for (const b of transport) {
      const seg =
        b.segments.find(
          (s) =>
            !s.barcode_data &&
            ((originCode && s.from_station_code?.toUpperCase() === originCode.toUpperCase()) ||
              (originName && s.from_station.slice(0, 4).toLowerCase() === originName.slice(0, 4).toLowerCase())),
        ) ?? b.segments.find((s) => !s.barcode_data);
      if (seg) {
        seg.barcode_data = barcode;
        seg.barcode_ref = seg.barcode_ref ?? b.booking_reference;
        break;
      }
    }
  }
}

function buildSearchQuery(): string {
  const senderClauses = BOOKING_SENDERS.map((s) => `from:${s}`).join(" OR ");
  const bodyProviders = BOOKING_SENDERS.map((s) => `"${s}"`).join(" OR ");
  const subjectTerms =
    "(subject:confirmation OR subject:booking OR subject:ticket OR subject:tickets OR subject:eticket OR subject:etickets OR subject:e-ticket OR subject:itinerary OR subject:reservation OR subject:amended OR subject:changed OR subject:updated OR subject:modification OR subject:trip)";
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const after = `${cutoff.getFullYear()}/${String(cutoff.getMonth() + 1).padStart(2, "0")}/${String(cutoff.getDate()).padStart(2, "0")}`;
  return `((${senderClauses}) OR (${subjectTerms} (${bodyProviders})) OR (${bodyProviders})) after:${after}`;
}

export async function scanGmailForBookings(): Promise<
  Result<{ bookings: ParsedBooking[]; scanned_count: number }>
> {
  const ctx = await requireUserContext();
  const gmail = await getValidGmailAccessToken();
  if (!gmail) {
    return err(
      errors.integration("gmail", "Gmail not connected. Connect in Settings."),
    );
  }

  const supabase = await createClient();

  // Already-imported message IDs to exclude — but "imported" must mean "still on a
  // plan". A booking deleted stop-by-stop (rather than via the run-delete that
  // releases the email) leaves an ORPHANED gmail_imported_messages row, and without
  // this check the scan would skip that email forever. So a row only counts as
  // imported if a LIVE stop still carries its message id (the import stamps it on
  // the departure stop's metadata). Orphans are released + the stale rows cleaned
  // up, so a deleted import can always be re-scanned and re-imported.
  const { data: imported } = await supabase
    .from("gmail_imported_messages")
    .select("gmail_message_id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId);
  const importedMsgIds = [...new Set((imported ?? []).map((r) => r.gmail_message_id as string))];

  const liveMsgIds = new Set<string>();
  if (importedMsgIds.length) {
    const { data: liveStops } = await supabase
      .from("stops")
      .select("metadata")
      .eq("workspace_id", ctx.workspaceId);
    for (const s of liveStops ?? []) {
      const meta = (s.metadata as Record<string, unknown> | null) ?? {};
      const one = typeof meta.gmail_message_id === "string" ? [meta.gmail_message_id] : [];
      const many = Array.isArray(meta.gmail_message_ids) ? (meta.gmail_message_ids as unknown[]) : [];
      for (const m of [...one, ...many]) if (typeof m === "string" && m) liveMsgIds.add(m);
    }
  }
  const orphanIds = importedMsgIds.filter((id) => !liveMsgIds.has(id));
  if (orphanIds.length) {
    await supabase
      .from("gmail_imported_messages")
      .delete()
      .eq("workspace_id", ctx.workspaceId)
      .in("gmail_message_id", orphanIds);
  }
  const importedIds = new Set(importedMsgIds.filter((id) => liveMsgIds.has(id)));

  let messageRefs;
  try {
    messageRefs = await gmailSearchMessages({
      accessToken: gmail.accessToken,
      query: buildSearchQuery(),
      maxResults: 50,
    });
  } catch (e) {
    console.error("gmail scan failed", e);
    return err(
      errors.integration(
        "gmail",
        "Failed to search Gmail. The connection may have expired — try reconnecting.",
      ),
    );
  }

  const toFetch = messageRefs.filter((ref) => !importedIds.has(ref.id));
  console.log("[gmail-scan] found:", messageRefs.length, "to fetch:", toFetch.length);

  // Fetch messages in parallel batches of 10 to stay well under Gmail rate limits.
  const BATCH_SIZE = 10;
  const bookings: ParsedBooking[] = [];
  let scannedCount = 0;

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (ref) => {
        const msg = await gmailGetMessage({
          accessToken: gmail.accessToken,
          messageId: ref.id,
        });

        const from = getHeader(msg.payload.headers, "From") ?? "";
        const subject = getHeader(msg.payload.headers, "Subject") ?? "";
        const date = getHeader(msg.payload.headers, "Date") ?? "";
        const { html, text } = extractMessageBody(msg);

        const emailDate =
          date && !isNaN(Date.parse(date))
            ? new Date(date).toISOString()
            : new Date(parseInt(msg.internalDate)).toISOString();

        // STRUCTURED-FIRST — read the schema.org JSON-LD reservations the email
        // embeds (the standard that powers Gmail trip cards). Deterministic and
        // authoritative: the boarding station + times come straight from the data,
        // not from scraping HTML/PDF (which read "Wellingborough 07:50" as
        // "Kettering 07:26"). Falls through to the legacy parsers when an email
        // carries no JSON-LD.
        // Big emails serve their HTML as an attachment, so the inline body is
        // empty and carries no JSON-LD — fetch the html part in that case.
        let structuredHtml = html ?? "";
        let fetchedAtt = false;
        if (!extractJsonLd(structuredHtml).length) {
          const htmlAttId = findHtmlAttachmentId(msg.payload as MsgPart);
          if (htmlAttId) {
            try {
              const buf = await gmailGetAttachment({ accessToken: gmail.accessToken, messageId: ref.id, attachmentId: htmlAttId });
              structuredHtml = buf.toString("utf8");
              fetchedAtt = true;
            } catch (e) {
              console.warn("gmail: html attachment fetch failed", ref.id, e);
            }
          }
        }
        const structured = parseStructuredFromHtml(structuredHtml, {
          gmail_message_id: ref.id,
          raw_subject: subject,
          email_date: emailDate,
          providerHint: providerHintFromSender(from),
        });
        // TEMP diagnostic (D103 chase) — what do the actual reservations say?
        // Dump every JSON-LD train reservation (number/status/origin/time) so we
        // can see whether the email's structured data genuinely carries the 07:50
        // or only the stale 07:13. Use _debug_routes_api (writable + cached schema).
        if (/derby|wellingborough/i.test(`${subject} ${from}`)) {
          try {
            const resv = extractJsonLd(structuredHtml)
              .filter((o) => /Reservation$/.test(String((o as Record<string, unknown>)["@type"] ?? "")))
              .map((o) => {
                const r = o as Record<string, unknown>;
                const forr = (r.reservationFor ?? {}) as Record<string, unknown>;
                const dep = (forr.departureStation ?? {}) as Record<string, unknown>;
                const arr = (forr.arrivalStation ?? {}) as Record<string, unknown>;
                return `${String(r.reservationNumber ?? "?")}|${String(r.reservationStatus ?? "?").replace(/^.*[/#]/, "")}|${String(dep.name ?? "?")}→${String(arr.name ?? "?")}|${String(forr.departureTime ?? "?")}`;
              })
              .join("  ;  ");
            await supabase.from("_debug_routes_api").insert({
              status: `GMAILDBG2 ${subject.slice(0, 60)}`,
              message: `struct=${structured.length} resv=[ ${resv} ]`,
            });
          } catch (e) {
            console.warn("debug insert failed", e);
          }
        }
        if (structured.length) {
          try {
            await graftBarcodesFromPdfs(gmail.accessToken, ref.id, msg, structured);
          } catch (e) {
            console.warn("gmail: barcode graft failed", ref.id, e);
          }
          return structured;
        }

        // LEGACY fallback — the per-retailer regex parsers + PDF enrichment.
        let parsed = detectAndParse(from, subject, html, text);
        if (!parsed) return [];

        // Enrich Trainline bookings with PDF attachment data (seat, coach, barcode)
        if (parsed.type === "transport" && /trainline/i.test(from)) {
          try {
            parsed = await enrichTrainlineFromPdfs(
              gmail.accessToken, ref.id, msg, parsed,
            );
          } catch (e) {
            console.warn("gmail: PDF enrichment failed", ref.id, e);
          }
        } else if (parsed.type === "transport" && /railsmartr|assertis/i.test(from)) {
          // RailSmartr's body is data-empty — the journey is in the eTicket PDFs.
          try {
            parsed = await enrichRailsmartrFromPdfs(
              gmail.accessToken, ref.id, msg, parsed,
            );
          } catch (e) {
            console.warn("gmail: railsmartr PDF enrichment failed", ref.id, e);
          }
          // Skeleton with no resolvable legs → nothing to import.
          if (!parsed || (parsed.type === "transport" && (parsed.segments?.length ?? 0) === 0)) {
            return [];
          }
        }

        // TEMP diagnostic — what the REGEX path made of an eticket (no JSON-LD).
        if (/derby|wellingborough/i.test(`${subject} ${from}`)) {
          try {
            const segs =
              parsed.type === "transport"
                ? (parsed.segments ?? []).map((s) => `${s.from_station}→${s.to_station} ${s.departure_time}-${s.arrival_time}`).join(" ; ")
                : parsed.type;
            await supabase.from("_debug_routes_api").insert({
              status: `GMAILDBG2 REGEX ${subject.slice(0, 50)}`,
              message: `ref=${parsed.type === "transport" ? parsed.booking_reference : "-"} segs=[ ${segs} ]`,
            });
          } catch (e) {
            console.warn("debug insert failed", e);
          }
        }

        return [{
          ...parsed,
          raw_subject: subject,
          gmail_message_id: ref.id,
          email_date: emailDate,
        } as ParsedBooking];
      }),
    );

    for (const r of results) {
      scannedCount++;
      if (r.status === "fulfilled" && r.value) {
        bookings.push(...r.value);
      } else if (r.status === "rejected") {
        console.warn("gmail: failed to fetch/parse message", r.reason);
      }
    }
  }

  // Drop past trips FIRST — before reconciling confirmation+eticket. The merge
  // groups by route (WEL→HAR), so a same-route trip from last week must be gone
  // before merging or it could collide with tomorrow's. Users want future trips.
  console.log("[gmail-scan] parsed:", bookings.length, bookings.map(b => `${b.type}:${b.raw_subject?.slice(0,40)}`));
  const today = new Date().toISOString().slice(0, 10);
  const future = bookings.filter((b) => {
    const travelDate = getTravelDate(b);
    const keep = !travelDate || travelDate >= today;
    if (!keep) console.log("[gmail-scan] dropped past:", b.raw_subject, "date:", travelDate);
    return keep;
  });

  // Reconcile: Trainline sends a booking confirmation (intended times + price)
  // AND an eticket (barcodes); merge them into one booking per route so an
  // anytime ticket isn't stranded at midnight.
  const futureBookings = deduplicateTrainlineBookings(future);
  console.log("[gmail-scan] after future filter + dedup:", futureBookings.length);

  // TEMP diagnostic — the FINAL list that reaches the panel. Reveals whether dedup
  // merged the 07:13 and 07:50 into one (and which times/ref/superseded survived).
  try {
    const dump = futureBookings
      .map((b) =>
        b.type === "transport"
          ? `{ref=${b.booking_reference} sup=${b.superseded_by ?? "-"} ${b.segments.map((s) => `${s.from_station}→${s.to_station} ${s.departure_time}`).join(",")}}`
          : `{acc ${b.hotel_name}}`,
      )
      .join("  ");
    await supabase.from("_debug_routes_api").insert({
      status: `GMAILDBG2 FINAL count=${futureBookings.length}`,
      message: dump.slice(0, 1500),
    });
  } catch (e) {
    console.warn("debug final insert failed", e);
  }

  // Update last_scan_at
  await supabase
    .from("gmail_connections")
    .update({ last_scan_at: new Date().toISOString() })
    .eq("id", gmail.connectionId);

  return ok({ bookings: futureBookings, scanned_count: scannedCount });
}

export async function markBookingImported(args: {
  gmail_message_id: string;
  booking_type: "transport" | "accommodation";
  travel_booking_id: string | null;
}): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gmail_imported_messages")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      gmail_message_id: args.gmail_message_id,
      booking_type: args.booking_type,
      travel_booking_id: args.travel_booking_id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return ok({ id: "already_imported" });
    }
    return err(errors.unexpected(error.message));
  }
  return ok({ id: data.id });
}

export async function disconnectGmail(): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("gmail_connections")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!existing) return err(errors.notFound("gmail_connection"));

  const { error } = await supabase
    .from("gmail_connections")
    .delete()
    .eq("id", existing.id);
  if (error) return err(errors.unexpected(error.message));

  return ok({ id: existing.id });
}

export async function debugFetchEmail(messageId: string): Promise<
  Result<{
    subject: string;
    from: string;
    cleanedText: string;
    html: string | null;
    attachments: Array<{ filename: string; mimeType: string; size: number }>;
    pdfTexts: string[];
    parsed: Partial<ParsedBooking> | null;
  }>
> {
  await requireUserContext();
  const gmail = await getValidGmailAccessToken();
  if (!gmail) return err(errors.integration("gmail", "Gmail not connected."));

  const msg = await gmailGetMessage({
    accessToken: gmail.accessToken,
    messageId,
  });

  const from = getHeader(msg.payload.headers, "From") ?? "";
  const subject = getHeader(msg.payload.headers, "Subject") ?? "";
  const { html, text } = extractMessageBody(msg);
  const cleanedText = text ?? (html ? stripHtmlPublic(html) : "");

  const attachmentList = extractAttachments(msg);
  const pdfAttachments = attachmentList.filter(
    (a) => a.mimeType === "application/pdf" || a.filename?.endsWith(".pdf"),
  );

  const pdfTexts: string[] = [];
  try {
    const { extractText } = await import("unpdf");
    for (const pdf of pdfAttachments) {
      const buf = await gmailGetAttachment({
        accessToken: gmail.accessToken,
        messageId,
        attachmentId: pdf.attachmentId,
      });
      const result = await extractText(new Uint8Array(buf).buffer);
      const pdfText = Array.isArray(result.text) ? result.text.join("\n") : result.text;
      pdfTexts.push(pdfText);
    }
  } catch (e) {
    console.warn("PDF extraction failed in debug", e);
  }

  let parsed = detectAndParse(from, subject, html, text);
  if (parsed?.type === "transport" && /trainline/i.test(from)) {
    try {
      parsed = await enrichTrainlineFromPdfs(
        gmail.accessToken, messageId, msg, parsed,
      );
    } catch (e) {
      console.warn("PDF enrichment failed in debug", e);
    }
  }

  return ok({
    subject,
    from,
    cleanedText,
    html,
    attachments: attachmentList.map((a) => ({
      filename: a.filename, mimeType: a.mimeType, size: a.size,
    })),
    pdfTexts,
    parsed,
  });
}
