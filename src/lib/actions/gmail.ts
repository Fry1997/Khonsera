"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { err, errors, ok, type Result } from "@/lib/errors";
import { getValidGmailAccessToken } from "@/lib/google/gmail-client";
import {
  gmailSearchMessages,
  gmailGetMessage,
  getHeader,
  extractMessageBody,
} from "@/lib/google/gmail";
import { detectAndParse, stripHtmlPublic } from "@/lib/gmail/parsers";
import { type ParsedBooking, getTravelDate } from "@/lib/gmail/types";

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

function buildSearchQuery(): string {
  const senderClauses = BOOKING_SENDERS.map((s) => `from:${s}`).join(" OR ");
  const subjectTerms =
    "(subject:confirmation OR subject:booking OR subject:ticket OR subject:e-ticket OR subject:itinerary OR subject:reservation OR subject:amended OR subject:changed OR subject:updated OR subject:modification)";
  // Search the last 3 months — flights and hotels are often booked well
  // in advance. The post-parse date filter drops anything where the
  // travel/check-in date has already passed.
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const after = `${cutoff.getFullYear()}/${String(cutoff.getMonth() + 1).padStart(2, "0")}/${String(cutoff.getDate()).padStart(2, "0")}`;
  return `(${senderClauses}) ${subjectTerms} after:${after}`;
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

        const parsed = detectAndParse(from, subject, html, text);
        if (!parsed) return null;

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
  const deduped = deduplicateTrainlineBookings(bookings);

  // Drop bookings where the travel date is in the past — users want
  // present/future bookings, not historical trips.
  const today = new Date().toISOString().slice(0, 10);
  const futureBookings = deduped.filter((b) => {
    const travelDate = getTravelDate(b);
    return !travelDate || travelDate >= today;
  });

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
  Result<{ subject: string; from: string; cleanedText: string; html: string | null; parsed: Partial<ParsedBooking> | null }>
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
  const parsed = detectAndParse(from, subject, html, text);

  return ok({ subject, from, cleanedText, html, parsed });
}
