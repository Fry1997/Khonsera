"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { err, errors, ok, type Result } from "@/lib/errors";
import { getValidGmailAccessToken } from "@/lib/google/gmail-client";
import { extractText } from "unpdf";
import {
  gmailSearchMessages,
  gmailGetMessage,
  gmailGetAttachment,
  findAttachments,
  getHeader,
  extractMessageBody,
  extractAttachments,
} from "@/lib/google/gmail";
import { detectAndParse, stripHtmlPublic } from "@/lib/gmail/parsers";
import { type ParsedBooking, getTravelDate } from "@/lib/gmail/types";
import {
  parseTrainlinePdfText,
  pdfTicketsToSegments,
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

  let PDFParse: typeof import("pdf-parse").PDFParse;
  try {
    PDFParse = (await import("pdf-parse")).PDFParse;
  } catch {
    return parsed;
  }

  const tickets = await Promise.all(
    pdfs.map(async (pdf) => {
      const buf = await gmailGetAttachment({
        accessToken, messageId, attachmentId: pdf.attachmentId,
      });
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      const result = await parser.getText();
      await parser.destroy();
      return parseTrainlinePdfText(result.text);
    }),
  );

  const validTickets = tickets.filter((t): t is NonNullable<typeof t> => t !== null);
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

  // If PDF segments lack barcode_data, try .pkpass downloads from email HTML
  const needsBarcodeData = pdfSegments.some((s) => !s.barcode_data);
  if (needsBarcodeData) {
    const { html } = extractMessageBody(msg);
    if (html) {
      const pkpassUrls: string[] = [];
      const urlPattern = /https:\/\/download\.thetrainline\.com\/resource#[A-F0-9]{64}/gi;
      let urlMatch;
      while ((urlMatch = urlPattern.exec(html)) !== null) {
        pkpassUrls.push(urlMatch[0]);
      }

      for (let i = 0; i < Math.min(pkpassUrls.length, pdfSegments.length); i++) {
        if (pdfSegments[i].barcode_data) continue;
        try {
          const pkpassBuf = await tryDownloadPkpass(pkpassUrls[i]);
          if (pkpassBuf) {
            const barcodeData = await extractBarcodeFromPkpass(pkpassBuf);
            if (barcodeData) {
              pdfSegments[i].barcode_data = barcodeData;
            }
          }
        } catch {
          // .pkpass download is best-effort
        }
      }
    }
  }

  return {
    ...parsed,
    segments: pdfSegments.length >= existingSegments.length ? pdfSegments : existingSegments,
  };
}

function buildSearchQuery(): string {
  const senderClauses = BOOKING_SENDERS.map((s) => `from:${s}`).join(" OR ");
  // Also match forwarded emails: the original sender won't be in `from:`,
  // but booking keywords + provider names will be in the body/subject.
  const bodyProviders = BOOKING_SENDERS.map((s) => `"${s}"`).join(" OR ");
  const subjectTerms =
    "(subject:confirmation OR subject:booking OR subject:ticket OR subject:tickets OR subject:eticket OR subject:etickets OR subject:e-ticket OR subject:itinerary OR subject:reservation OR subject:amended OR subject:changed OR subject:updated OR subject:modification OR subject:trip)";
  // Search the last 3 months — flights and hotels are often booked well
  // in advance. The post-parse date filter drops anything where the
  // travel/check-in date has already passed.
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const after = `${cutoff.getFullYear()}/${String(cutoff.getMonth() + 1).padStart(2, "0")}/${String(cutoff.getDate()).padStart(2, "0")}`;
  // Match either: (1) direct from a known sender, OR (2) any email
  // with booking keywords in the subject that mentions a provider in
  // the body (catches forwarded emails), OR (3) any email that just
  // mentions a known provider name anywhere (broadest net).
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

  // Check which messages we've already scanned (skip re-fetching).
  const { data: alreadyScanned } = await supabase
    .from("gmail_scanned_emails")
    .select("gmail_message_id, parsed_type, parsed_data, parse_failed, imported")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId);
  const scannedMap = new Map(
    (alreadyScanned ?? []).map((r) => [r.gmail_message_id, r]),
  );

  const toFetch = messageRefs.filter(
    (ref) => {
      if (importedIds.has(ref.id)) return false;
      const prev = scannedMap.get(ref.id);
      if (!prev) return true;
      if (prev.parse_failed) return true;
      return false;
    },
  );

  console.log("[gmail-scan] query:", buildSearchQuery());
  console.log("[gmail-scan] messages found:", messageRefs.length, "already scanned:", scannedMap.size, "to fetch:", toFetch.length);

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

        // Extract text from PDF attachments (etickets have the actual
        // train times, service numbers, and seat assignments).
        let pdfText = "";
        const attachments = findAttachments(msg);
        const pdfAttachments = attachments.filter(
          (a) =>
            a.mimeType === "application/pdf" ||
            a.filename.toLowerCase().endsWith(".pdf"),
        );
        for (const att of pdfAttachments) {
          try {
            const buf = await gmailGetAttachment({
              accessToken: gmail.accessToken,
              messageId: ref.id,
              attachmentId: att.attachmentId,
            });
            const pdfData = await extractText(buf);
            pdfText += "\n" + pdfData.text;
          } catch (e) {
            console.warn(`[gmail-scan] failed to parse PDF ${att.filename}:`, e);
          }
        }

        // Combine email body + PDF text for parsing.
        const combinedText = (text ?? "") + pdfText;
        const combinedHtml = html ?? "";

        const parsed = detectAndParse(from, subject, combinedHtml, combinedText);

        // Persist to gmail_scanned_emails for debugging + cache.
        await supabase.from("gmail_scanned_emails").upsert(
          {
            workspace_id: ctx.workspaceId,
            user_id: ctx.userId,
            gmail_message_id: ref.id,
            sender: from.slice(0, 500),
            subject: subject.slice(0, 500),
            parsed_type: parsed?.type ?? null,
            parsed_data: parsed ? (parsed as unknown as Record<string, unknown>) : null,
            parse_failed: !parsed,
            imported: false,
          },
          { onConflict: "workspace_id,user_id,gmail_message_id" },
        );

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

  // Also include previously-scanned-but-not-imported bookings so
  // the user can still pick them up later.
  for (const [msgId, row] of scannedMap) {
    if (row.imported || row.parse_failed || !row.parsed_data) continue;
    if (importedIds.has(msgId)) continue;
    bookings.push({
      ...(row.parsed_data as unknown as ParsedBooking),
      gmail_message_id: msgId,
    });
  }

  // Drop bookings where the travel date is in the past.
  const today = new Date().toISOString().slice(0, 10);
  const futureBookings = deduped.filter((b) => {
    const travelDate = getTravelDate(b);
    return !travelDate || travelDate >= today;
  });
  console.log(`[gmail-scan] total: ${bookings.length}, future: ${futureBookings.length}`);

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
    const { PDFParse } = await import("pdf-parse");
    for (const pdf of pdfAttachments) {
      const buf = await gmailGetAttachment({
        accessToken: gmail.accessToken,
        messageId,
        attachmentId: pdf.attachmentId,
      });
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      const result = await parser.getText();
      pdfTexts.push(result.text);
      await parser.destroy();
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
