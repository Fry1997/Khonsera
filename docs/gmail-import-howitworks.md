# How the Gmail booking import works (plain-language)

_Last updated 2026-06-25, after the Wellingborough↔Derby debugging session._

This document explains, in non-technical terms, **how Khonsera turns the booking
emails in your inbox into trips you can import** — what it reads, what decisions it
makes, what it throws away, and how robust it actually is. It's the reference for
anyone who picks this up later.

---

## Part 1 — The process flow (what it does, step by step)

Think of it as a sorting line. An email comes in one end; a clean, de-duplicated
list of upcoming trips comes out the other.

### 1. Cast a wide net for booking emails
It searches your Gmail using **three overlapping nets**, on purpose:
- **Known senders** — Trainline, LNER, easyJet, etc.
- **Subject words + a provider name** — "eticket", "etickets", "tickets", "trip",
  "confirmation", "booking", "e-ticket"… combined with a provider name in the body.
- **A provider name anywhere** — the broadest catch.

Why three nets? So a **forwarded** confirmation (where the sender is your friend, not
Trainline) and Trainline's oddly-worded subjects ("Your **etickets** to Derby") still
get caught. Missing a real booking is worse than catching a few extra emails.

### 2. Throw out the junk
It **skips marketing emails** by looking at the **subject** for words like
_unsubscribe, newsletter, offer, % off, savings, discount, promo, competition, win_.
It checks the **subject, not the body** — because every real Trainline email has
"unsubscribe" in its footer, so checking the body would bin your actual tickets.

### 3. Read each email — best source first
For every surviving email it tries sources in order of trustworthiness:
1. **The hidden machine-readable data** (schema.org JSON-LD) that Trainline, airlines
   and hotels embed in the email — the same data Gmail uses to draw its little trip
   cards. This is **authoritative**: the stations and times come straight from the
   data, not from guessing at the visible text.
2. If that data lives in a **large attached HTML file** (big emails store their body
   as an attachment), it fetches that and reads the data from there.
3. If there's **no machine data at all**, it falls back to **reading the visible text
   and PDFs** with pattern-matching, tuned per retailer.
4. For Trainline it also **opens the PDF tickets** to pull seat, coach, price, the
   booking reference, and the **barcode** (the Aztec you scan at the gate).

### 4. Fill in the changeovers (the bit we just built)
The machine data only gives the **start and end** of each direction
(Wellingborough → Derby). But you need the **changeover stations** — where you
physically change trains — regardless of what ticket type you bought.

So it **also reads the printed itinerary** in the email
("07:50 Wellingborough … 08:20 Leicester, change … 08:37 Leicester … 09:08 Derby")
and **splits the trip into its real legs with times**.

**The safety rule:** it only does this split if the legs it reads **line up exactly**
with the trusted start and end (same first departure time + station, same final
arrival time + station). If they don't line up, it **leaves the trip as start→end and
never invents a route**. Better to show less than to show something wrong.

### 5. Put every time on the UK clock
Some tickets are stamped in **UTC**, some in **British Summer Time**. It converts
everything to **UK local time**, so an 07:13 train is never shown as 06:13.

### 6. Drop trips in the past
Anything before **today** is removed — you're importing **upcoming** travel.

### 7. Combine the duplicate emails for one booking
Trainline sends **more than one email per booking** (a confirmation _and_ an eticket,
sometimes more). It groups them by the **booking reference**:
- **Same reference → same booking** (combined into one).
- **Different reference → different bookings** (kept separate — this is what stopped
  your new 07:50 from being swallowed by the old 07:13).
- A stray ticket with **no readable reference** joins the **single best-matching**
  booking by shared stations — and can **never glue two real bookings together**.

When it combines them, it keeps the richest version: the one with the most real
leg-times becomes the spine, and the barcodes from the eticket are **grafted onto the
matching legs** by station.

### 8. Flag rebookings (never silently delete)
If two **separate** bookings are the **same trip, same day**, but were **booked at
different times** (you rebooked after a cancellation), it **keeps both** and flags the
older one as **"Earlier booking"**, recommending the newer — it **never quietly
deletes** one, because only you know which train you're actually taking.

### 9. Hand you the list
You see each booking with its legs, times, price, ticket type and barcodes, and **you
choose** what to import. Nothing is imported without your say-so.

---

## Part 2 — The decisions it makes (and what it removes/ignores)

**Decisions:**
| Question | How it decides |
|---|---|
| Is this email a booking? | Matches one of the three search nets |
| Which source do I trust? | Machine data (JSON-LD) **over** printed text/PDF |
| Should I split into legs? | Only if the itinerary's legs match the trusted start/end exactly |
| Are these two emails the same booking? | Same **booking reference** = yes |
| Which of two same-day bookings is current? | The **more recently booked** one wins (older is flagged, not deleted) |

**What it removes or ignores:**
- Marketing emails (judged by **subject**).
- Trips **before today**.
- **Cancelled** legs (when the machine data marks them cancelled).
- **Duplicate** emails for one booking (merged, not shown twice).
- Any changeover route it **can't verify** against the trusted start/end (it shows
  start→end rather than a guess).

---

## Part 3 — How robust is it, really? (an honest assessment)

This was hard-won. We hit **five separate real-world breakages** in one session, each
a variation the tool hadn't seen. So the verdict is nuanced:

### The backbone is solid
Reading the **machine-readable JSON-LD first** is the right, robust design — it
doesn't depend on fragile text layout. The **reference-keyed de-duplication**, the
**future-only filter**, the **UK-time conversion**, and the **"only split if it
matches the endpoints" safety rule** are all sound and degrade gracefully (when
unsure, they show _less_, never _wrong_).

### Verified working on real journeys (not just test data)
From your actual confirmation emails:
| Journey | Shape | Result |
|---|---|---|
| 07:50 Derby (Anytime Day Return) | 1 change (Leicester) | ✅ 2 legs each way |
| 07:13 Derby (Advance Single) | **2 changes** (Kettering + Leicester) | ✅ 3 legs each way |
| Harpenden (11 Jun) | 1 change, **two operators** (EMR + Thameslink) | ✅ correct |
| Any direct train | no change | ✅ stays one clean leg |

So **multiple changes and mixed operators already work** — the leg-splitter scales to
however many changes the itinerary lists.

### Where it's still fragile (the honest part)
- **It depends on Trainline's itinerary wording.** If Trainline restructures that part
  of the email, the leg-splitter may stop finding the changes — it would then fall back
  to showing start→end (safe, but you'd lose the changeover detail until we update it).
- **It's Trainline-tuned.** The JSON-LD backbone is generic, but the **leg-splitting
  and PDF reading are tuned to Trainline**. A booking **straight from LNER/Avanti/GWR**
  may import as start→end without the per-leg breakdown.
- **UK only.** Times are converted assuming **UK** (Europe/London). An international
  leg would be wrong.
- **Barcodes are best-effort.** If a PDF won't decode, the trip still imports but a
  given leg might lack its scannable code.
- **It's been hardened reactively.** Every fix this session was a response to a real
  email that broke it. New formats will likely surface new gaps **until** we build a
  safety net of saved real examples (below).

### The one thing that would make it genuinely robust
**A library of real (anonymised) booking emails kept as automated tests** — a "golden
set". Every new format you throw at it that works gets saved; every one that breaks
gets fixed _and_ saved, so it can never silently break again. Today we have unit tests
for the cases we've seen; turning your real inbox variety into permanent tests is what
moves this from "works on what we've tried" to "won't regress."

A longer-term option (already noted in the codebase as a benched idea) is an
**AI-assisted fallback** for emails whose format we don't recognise — but the
deterministic parser above should stay the primary path; it's cheaper, faster and
explainable.
