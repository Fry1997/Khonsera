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
import {
  parseTrainlinePdfText,
  pdfTicketsToSegments,
  decodeAztecFromPdf,
  tryDownloadPkpass,
  extractBarcodeFromPkpass,
} from "@/lib/gmail/trainline-pdf";

const BOOKING_SENDERS = [
  "trainline",
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

function deduplicateTrainlineBookings(bookings: ParsedBooking[]): ParsedBooking[] {
  const trainline: ParsedBooking[] = [];
  const rest: ParsedBooking[] = [];

  for (const b of bookings) {
    if (b.type === "transport" && b.provider === "Trainline") {
      trainline.push(b);
    } else {
      rest.push(b);
    }
  }

  if (trainline.length <= 1) return bookings;

  // Group by travel date — bookings on the same date are likely duplicates
  const byDate = new Map<string, ParsedBooking[]>();
  for (const b of trainline) {
    const date = getTravelDate(b) ?? "unknown";
    const group = byDate.get(date) ?? [];
    group.push(b);
    byDate.set(date, group);
  }

  const kept: ParsedBooking[] = [];
  for (const group of byDate.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    // Prefer booking confirmation (has departure times != "00:00") over eticket
    const scored = group.map((b) => {
      let score = 0;
      if (b.type === "transport") {
        if (/booking\s*confirmation/i.test(b.raw_subject)) score += 10;
        if (b.price != null) score += 3;
        const hasTimes = b.segments.some((s) => s.departure_time && s.departure_time !== "00:00");
        if (hasTimes) score += 5;
      }
      return { booking: b, score };
    });
    scored.sort((a, b) => b.score - a.score);
    kept.push(scored[0].booking);
  }

  return [...rest, ...kept];
}

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

  const tickets = await Promise.all(
    pdfBuffers.map(async (buf) => {
      if (!buf) return null;
      try {
        const result = await extractText(new Uint8Array(buf).buffer);
        const pdfText = Array.isArray(result.text) ? result.text.join("\n") : result.text;
        return parseTrainlinePdfText(pdfText);
      } catch {
        return null;
      }
    }),
  );

  const validTickets = tickets.filter((t): t is NonNullable<typeof t> => t !== null);
  if (validTickets.length === 0) return parsed;

  // Decode Aztec barcodes from PDF images
  for (let i = 0; i < validTickets.length; i++) {
    if (validTickets[i].barcode_data) continue;
    const buf = pdfBuffers[i];
    if (!buf) continue;
    try {
      const barcodeData = await decodeAztecFromPdf(new Uint8Array(buf).buffer);
      if (barcodeData) validTickets[i].barcode_data = barcodeData;
    } catch {
      // Barcode decoding is best-effort
    }
  }

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

  // Get already-imported message IDs to exclude
  const { data: imported } = await supabase
    .from("gmail_imported_messages")
    .select("gmail_message_id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId);
  const importedIds = new Set((imported ?? []).map((r) => r.gmail_message_id));

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

        let parsed = detectAndParse(from, subject, html, text);
        if (!parsed) return null;

        // Enrich Trainline bookings with PDF attachment data (seat, coach, barcode)
        if (parsed.type === "transport" && /trainline/i.test(from)) {
          try {
            parsed = await enrichTrainlineFromPdfs(
              gmail.accessToken, ref.id, msg, parsed,
            );
          } catch (e) {
            console.warn("gmail: PDF enrichment failed", ref.id, e);
          }
        }

        const emailDate =
          date && !isNaN(Date.parse(date))
            ? new Date(date).toISOString()
            : new Date(parseInt(msg.internalDate)).toISOString();

        return {
          ...parsed,
          raw_subject: subject,
          gmail_message_id: ref.id,
          email_date: emailDate,
        } as ParsedBooking;
      }),
    );

    for (const r of results) {
      scannedCount++;
      if (r.status === "fulfilled" && r.value) {
        bookings.push(r.value);
      } else if (r.status === "rejected") {
        console.warn("gmail: failed to fetch/parse message", r.reason);
      }
    }
  }

  // Deduplicate: when Trainline sends both a booking confirmation and an
  // eticket for the same trip, keep only the booking confirmation (it has
  // times and price; the eticket just has station codes).
  console.log("[gmail-scan] parsed:", bookings.length, bookings.map(b => `${b.type}:${b.raw_subject?.slice(0,40)}`));
  const deduped = deduplicateTrainlineBookings(bookings);
  console.log("[gmail-scan] after dedup:", deduped.length);

  // Drop bookings where the travel date is in the past — users want
  // present/future bookings, not historical trips.
  const today = new Date().toISOString().slice(0, 10);
  const futureBookings = deduped.filter((b) => {
    const travelDate = getTravelDate(b);
    const keep = !travelDate || travelDate >= today;
    if (!keep) console.log("[gmail-scan] dropped past:", b.raw_subject, "date:", travelDate);
    return keep;
  });
  console.log("[gmail-scan] after date filter:", futureBookings.length);

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

// ── reEnrichItineraryFromGmail ────────────────────────────────────────
// Re-fetches Trainline PDF attachments from Gmail for an existing
// itinerary's transit stops. Re-parses with the updated parser (which
// now extracts calling points) and patches stop metadata + segments.

export async function reEnrichItineraryFromGmail(
  itineraryId: string,
): Promise<Result<{ enriched: number }>> {
  const ctx = await requireUserContext();
  const gmail = await getValidGmailAccessToken();
  if (!gmail) {
    return err(errors.integration("gmail", "Gmail not connected. Connect in Settings."));
  }
  const supabase = await createClient();

  // Find transit_departure stops for this itinerary
  const { data: transitStops } = await supabase
    .from("stops")
    .select("id, metadata, transport_hub_id")
    .eq("itinerary_id", itineraryId)
    .eq("workspace_id", ctx.workspaceId)
    .in("type", ["transit_departure", "transit_changeover"]);

  if (!transitStops || transitStops.length === 0) return ok({ enriched: 0 });

  // Filter to stops that don't already have calling_points
  const stopsToEnrich = transitStops.filter((s) => {
    const meta = s.metadata as Record<string, unknown> | null;
    return meta && !meta.calling_points;
  });
  if (stopsToEnrich.length === 0) return ok({ enriched: 0 });

  // Collect gmail_message_ids from the scan cache that match our booking refs
  const bookingRefs = new Set<string>();
  for (const s of stopsToEnrich) {
    const meta = s.metadata as Record<string, unknown> | null;
    if (meta?.booking_reference) bookingRefs.add(meta.booking_reference as string);
    if (meta?.barcode_ref) bookingRefs.add(meta.barcode_ref as string);
  }

  // Search Gmail for Trainline emails (re-use the same broad search)
  const query = buildSearchQuery();
  let messageRefs;
  try {
    messageRefs = await gmailSearchMessages({
      accessToken: gmail.accessToken,
      query,
    });
  } catch {
    return err(errors.integration("gmail", "Failed to search Gmail."));
  }

  let enrichedCount = 0;

  // Process each message — fetch, parse PDFs, look for calling points
  for (const ref of messageRefs.slice(0, 20)) {
    let msg;
    try {
      msg = await gmailGetMessage({ accessToken: gmail.accessToken, messageId: ref.id });
    } catch { continue; }

    const attachments = extractAttachments(msg);
    const pdfs = attachments.filter(
      (a) => a.mimeType === "application/pdf" || a.filename?.endsWith(".pdf"),
    );
    if (pdfs.length === 0) continue;

    // Fetch and parse each PDF
    for (const pdf of pdfs) {
      let buf: Buffer;
      try {
        buf = await gmailGetAttachment({
          accessToken: gmail.accessToken,
          messageId: ref.id,
          attachmentId: pdf.attachmentId,
        });
      } catch { continue; }

      const { extractText } = await import("unpdf").catch(() => ({ extractText: null }));
      if (!extractText) continue;

      let ticket;
      try {
        const result = await extractText(new Uint8Array(buf).buffer);
        const pdfText = Array.isArray(result.text) ? result.text.join("\n") : result.text;
        ticket = parseTrainlinePdfText(pdfText);
      } catch { continue; }
      if (!ticket || ticket.calling_points.length === 0) continue;

      // Match this ticket to a stop by barcode_ref or station codes
      for (const stop of stopsToEnrich) {
        const meta = stop.metadata as Record<string, unknown> | null;
        if (!meta) continue;

        const matchByBarcode = meta.barcode_ref && ticket.barcode_ref &&
          meta.barcode_ref === ticket.barcode_ref;
        const matchByRef = meta.booking_reference && ticket.nrs_ref &&
          meta.booking_reference === ticket.nrs_ref;

        if (!matchByBarcode && !matchByRef) continue;

        // Resolve calling point coordinates
        const cpCodes = ticket.calling_points
          .filter((cp) => cp.station_code)
          .map((cp) => cp.station_code!);
        const cpCoords = new Map<string, { lat: number; lng: number }>();
        if (cpCodes.length > 0) {
          const { data: hubs } = await supabase
            .from("transport_hubs")
            .select("code, latitude, longitude")
            .in("code", cpCodes)
            .eq("kind", "rail_station");
          for (const h of hubs ?? []) {
            if (h.latitude && h.longitude) {
              cpCoords.set(h.code, { lat: Number(h.latitude), lng: Number(h.longitude) });
            }
          }
        }

        const enrichedCps = ticket.calling_points.map((cp) => {
          const coords = cpCoords.get(cp.station_code ?? "");
          return { ...cp, lat: coords?.lat ?? null, lng: coords?.lng ?? null };
        });

        // Patch the stop metadata
        await supabase
          .from("stops")
          .update({
            metadata: { ...meta, calling_points: enrichedCps },
          })
          .eq("id", stop.id)
          .eq("workspace_id", ctx.workspaceId);

        enrichedCount++;
      }
    }
  }

  // Regenerate rail polylines using the updated calling points as waypoints
  if (enrichedCount > 0) {
    const { backfillRailPolylines } = await import("@/lib/actions/transitions");
    await backfillRailPolylines(itineraryId, true);
  }

  return ok({ enriched: enrichedCount });
}
