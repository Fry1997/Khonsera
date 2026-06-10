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
      const ab = new Uint8Array(buf).buffer;
      let ticket: ReturnType<typeof parseTrainlinePdfText> = null;
      try {
        const result = await extractText(ab);
        const pdfText = Array.isArray(result.text) ? result.text.join("\n") : result.text;
        ticket = parseTrainlinePdfText(pdfText);
      } catch {
        // text extraction failed
      }
      if (!ticket) return null;
      try {
        const barcodeData = await decodeAztecFromPdf(ab);
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

// Debug: dump what the scanner sees + parses for every matching email, so we can
// diagnose why a booking's times aren't extracted (e.g. an anytime ticket where
// only the confirmation carries times). Read-only; surfaced at /plan/debug-scan.
// Debug: per-PDF detail for Trainline eticket attachments — did the text parse
// give from/to, and did the Aztec decode? Read-only; surfaced at /plan/debug-scan.
export async function debugTrainlinePdfs(): Promise<
  Result<{
    rows: Array<{
      subject: string;
      pdfs: Array<{
        filename: string;
        parsedFrom: string;
        parsedTo: string;
        ticketRef: string | null;
        ticketType: string | null;
        barcodeDecoded: boolean;
        barcodeLen: number;
        textSnippet: string;
      }>;
    }>;
  }>
> {
  await requireUserContext();
  const gmail = await getValidGmailAccessToken();
  if (!gmail) return err(errors.integration("gmail", "Gmail not connected."));

  let refs;
  try {
    refs = await gmailSearchMessages({ accessToken: gmail.accessToken, query: buildSearchQuery(), maxResults: 30 });
  } catch (e) {
    return err(errors.integration("gmail", `Search failed: ${String(e)}`));
  }

  const { extractText } = await import("unpdf").catch(() => ({ extractText: null }));
  type PdfRow = {
    filename: string;
    parsedFrom: string;
    parsedTo: string;
    ticketRef: string | null;
    ticketType: string | null;
    barcodeDecoded: boolean;
    barcodeLen: number;
    textSnippet: string;
  };
  const rows: Array<{ subject: string; pdfs: PdfRow[] }> = [];

  for (const ref of refs.slice(0, 30)) {
    try {
      const msg = await gmailGetMessage({ accessToken: gmail.accessToken, messageId: ref.id });
      const from = getHeader(msg.payload.headers, "From") ?? "";
      const subject = getHeader(msg.payload.headers, "Subject") ?? "";
      if (!/trainline/i.test(from)) continue;
      const attachments = extractAttachments(msg).filter(
        (a) => a.mimeType === "application/pdf" || a.filename?.endsWith(".pdf"),
      );
      if (attachments.length === 0) continue;

      const pdfs: PdfRow[] = [];
      for (const att of attachments) {
        let buf: Buffer | null = null;
        try {
          buf = await gmailGetAttachment({ accessToken: gmail.accessToken, messageId: ref.id, attachmentId: att.attachmentId });
        } catch {
          // skip
        }
        let text = "";
        if (buf && extractText) {
          try {
            const r = await extractText(new Uint8Array(buf).buffer);
            text = Array.isArray(r.text) ? r.text.join("\n") : r.text;
          } catch {
            // extraction failed
          }
        }
        const ticket = text ? parseTrainlinePdfText(text) : null;
        let barcode: string | null = null;
        if (buf) {
          try {
            barcode = await decodeAztecFromPdf(new Uint8Array(buf).buffer);
          } catch {
            // decode failed
          }
        }
        pdfs.push({
          filename: att.filename ?? "(no name)",
          parsedFrom: ticket?.from_code ?? "",
          parsedTo: ticket?.to_code ?? "",
          ticketRef: ticket?.barcode_ref ?? null,
          ticketType: ticket?.ticket_type ?? null,
          barcodeDecoded: !!barcode,
          barcodeLen: barcode?.length ?? 0,
          textSnippet: text.slice(0, 700),
        });
      }
      rows.push({ subject, pdfs });
    } catch {
      // skip unreadable message
    }
  }

  return ok({ rows });
}

export async function debugScanTrainline(): Promise<
  Result<{
    rows: Array<{
      id: string;
      from: string;
      subject: string;
      detected: boolean;
      type: string | null;
      provider: string | null;
      trainTimesUrls: string[];
      segments: Array<{ from: string; to: string; depDate: string; depTime: string; arrTime: string }>;
      textSnippet: string;
    }>;
  }>
> {
  await requireUserContext();
  const gmail = await getValidGmailAccessToken();
  if (!gmail) return err(errors.integration("gmail", "Gmail not connected."));

  let refs;
  try {
    refs = await gmailSearchMessages({ accessToken: gmail.accessToken, query: buildSearchQuery(), maxResults: 30 });
  } catch (e) {
    return err(errors.integration("gmail", `Search failed: ${String(e)}`));
  }

  type DebugRow = {
    id: string;
    from: string;
    subject: string;
    detected: boolean;
    type: string | null;
    provider: string | null;
    trainTimesUrls: string[];
    segments: Array<{ from: string; to: string; depDate: string; depTime: string; arrTime: string }>;
    textSnippet: string;
  };
  const rows: DebugRow[] = [];

  for (const ref of refs.slice(0, 30)) {
    try {
      const msg = await gmailGetMessage({ accessToken: gmail.accessToken, messageId: ref.id });
      const from = getHeader(msg.payload.headers, "From") ?? "";
      const subject = getHeader(msg.payload.headers, "Subject") ?? "";
      const { html, text } = extractMessageBody(msg);
      const cleaned = text ?? (html ? stripHtmlPublic(html) : "");
      // Trainline embeds intended times in /train-times/{from}-to-{to}/{date}/{HHMM} URLs.
      const urls = [...(html ?? "").matchAll(/train-times\/[^"'\s)]+/gi)].map((m) => m[0]).slice(0, 12);
      const parsed = detectAndParse(from, subject, html, text);
      const segs =
        parsed?.type === "transport"
          ? (parsed.segments ?? []).map((s) => ({
              from: s.from_station,
              to: s.to_station,
              depDate: s.departure_date,
              depTime: s.departure_time,
              arrTime: s.arrival_time,
            }))
          : [];
      rows.push({
        id: ref.id,
        from,
        subject,
        detected: parsed != null,
        type: parsed?.type ?? null,
        provider: parsed && "provider" in parsed ? (parsed as { provider?: string }).provider ?? null : null,
        trainTimesUrls: urls,
        segments: segs,
        textSnippet: cleaned.slice(0, 1500),
      });
    } catch {
      // skip unreadable message
    }
  }

  return ok({ rows });
}
