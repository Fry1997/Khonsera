import { describe, expect, it } from "vitest";
import { extractJsonLd, parseStructuredFromHtml } from "@/lib/gmail/structured-parser";

// The REAL JSON-LD from the founder's Trainline "Wellingborough → Derby" email
// (25 Jun 2026) — the one the regex pipeline turned into "Kettering 07:26".
const DERBY_LD = `
<html><body>
<script type="application/ld+json">
[
  {"@context":"http://schema.org","@type":"TrainReservation","reservationNumber":"471218902520",
   "reservationId":"471218902520 , 06/25/2026 07:50","reservationStatus":"http://schema.org/ReservationConfirmed",
   "reservationFor":{"@type":"TrainTrip","departureStation":{"@type":"TrainStation","name":"Wellingborough"},
     "departureTime":"2026-06-25T07:50:00+01:00","arrivalStation":{"@type":"TrainStation","name":"Derby"},
     "arrivalTime":"2026-06-25T09:08:00+01:00","trainNumber":""}},
  {"@context":"http://schema.org","@type":"TrainReservation","reservationNumber":"471218902520",
   "reservationId":"471218902520 , 06/25/2026 15:09","reservationStatus":"http://schema.org/ReservationConfirmed",
   "reservationFor":{"@type":"TrainTrip","departureStation":{"@type":"TrainStation","name":"Derby"},
     "departureTime":"2026-06-25T15:09:00+01:00","arrivalStation":{"@type":"TrainStation","name":"Wellingborough"},
     "arrivalTime":"2026-06-25T16:31:00+01:00","trainNumber":""}}
]
</script>
</body></html>`;

const ctx = { gmail_message_id: "m1", raw_subject: "Wellingborough to Derby", email_date: "2026-06-24", providerHint: "Trainline" };

describe("structured (JSON-LD) booking parser", () => {
  it("extracts the JSON-LD reservations", () => {
    const objs = extractJsonLd(DERBY_LD);
    expect(objs).toHaveLength(2);
    expect(objs[0]["@type"]).toBe("TrainReservation");
  });

  it("parses the Derby trip with the CORRECT boarding station + times (not Kettering)", () => {
    const out = parseStructuredFromHtml(DERBY_LD, ctx);
    expect(out).toHaveLength(1); // one booking — out + return share the reservation number
    const b = out[0];
    if (b.type !== "transport") throw new Error("expected transport");
    expect(b.provider).toBe("Trainline");
    expect(b.booking_reference).toBe("471218902520");
    expect(b.mode).toBe("train");
    expect(b.segments).toHaveLength(2);
    // Outbound — the real boarding station + time, the whole point of this fix.
    expect(b.segments[0]).toMatchObject({
      from_station: "Wellingborough",
      to_station: "Derby",
      departure_date: "2026-06-25",
      departure_time: "07:50",
      arrival_time: "09:08",
    });
    // Return.
    expect(b.segments[1]).toMatchObject({
      from_station: "Derby",
      to_station: "Wellingborough",
      departure_time: "15:09",
      arrival_time: "16:31",
    });
  });

  it("drops a CANCELLED reservation (the rebooking case)", () => {
    const cancelled = DERBY_LD.replace("471218902520 , 06/25/2026 07:50\",\"reservationStatus\":\"http://schema.org/ReservationConfirmed", "471218902520 , 06/25/2026 07:50\",\"reservationStatus\":\"http://schema.org/ReservationCancelled");
    const out = parseStructuredFromHtml(cancelled, ctx);
    const segs = out.flatMap((b) => (b.type === "transport" ? b.segments : []));
    expect(segs.every((s) => s.departure_time !== "07:50")).toBe(true); // cancelled outbound gone
  });

  it("returns nothing for an email with no JSON-LD", () => {
    expect(parseStructuredFromHtml("<html><body>just marketing</body></html>", ctx)).toEqual([]);
  });

  it("normalises a UTC-encoded departure to UK local time (06:13Z → 07:13)", () => {
    // The real MC287441 ticket: Trainline encodes it in UTC (+00:00), not BST, so a
    // 07:13 BST departure arrives as 06:13Z. Taking the wall-clock digits imported
    // it an hour early; we must convert the instant to Europe/London.
    const utcLd = `<script type="application/ld+json">
      {"@type":"TrainReservation","reservationNumber":"MC287441","reservationStatus":"http://schema.org/ReservationConfirmed",
       "reservationFor":{"@type":"TrainTrip","departureStation":{"name":"Wellingborough"},
         "departureTime":"2026-06-25T06:13:00+00:00","arrivalStation":{"name":"Derby"},
         "arrivalTime":"2026-06-25T08:32:00+00:00"}}
    </script>`;
    const out = parseStructuredFromHtml(utcLd, ctx);
    expect(out).toHaveLength(1);
    const b = out[0];
    if (b.type !== "transport") throw new Error("expected transport");
    expect(b.segments[0].departure_time).toBe("07:13");
    expect(b.segments[0].arrival_time).toBe("09:32");
  });

  it("keeps a BST-encoded departure as-is (07:50+01:00 → 07:50)", () => {
    const bstLd = `<script type="application/ld+json">
      {"@type":"TrainReservation","reservationNumber":"471218902520","reservationStatus":"http://schema.org/ReservationConfirmed",
       "reservationFor":{"@type":"TrainTrip","departureStation":{"name":"Wellingborough"},
         "departureTime":"2026-06-25T07:50:00+01:00","arrivalStation":{"name":"Derby"},
         "arrivalTime":"2026-06-25T09:08:00+01:00"}}
    </script>`;
    const out = parseStructuredFromHtml(bstLd, ctx);
    const b = out[0];
    if (b.type !== "transport") throw new Error("expected transport");
    expect(b.segments[0].departure_time).toBe("07:50");
    expect(b.segments[0].arrival_time).toBe("09:08");
  });
});
