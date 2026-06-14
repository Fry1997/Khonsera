# Provider procurement handoff (founder action list)

**The reassuring frame first:** *nothing here blocks the build.* Every external provider is behind a
mock + an env-gated adapter, so the product runs end-to-end today on sample data (shown with a
"· sample" cue). This document is the checklist to **light each feature up for real in production** —
who the provider is, what feature it powers, the cost model, the env var to set, and the action you
take. Sorted by *how much effort the action is*, easiest first.

Set an env var → that feature flips from sample to live. No code change.

---

## A · Already live / no action needed

| Provider | Powers | Cost | Env | Status |
|---|---|---|---|---|
| **Darwin / LDBWS** (Rail Data Marketplace) | Live train times, delays, cancellations → the whole live-rail spine + recovery (P9–P11) | Free | `DARWIN_LDBWS_TOKEN` | ✅ keyed & live in prod |
| **Open-Meteo** | Weather → "leave earlier" rule (P12) | Free **for non-commercial**; see decision #2 | *(keyless)* | ✅ live, but commercial-use caveat |

## B · Cheap/free, self-serve — minutes of your time

| Provider | Who / what | Powers | Cost | Env | Action |
|---|---|---|---|---|---|
| **TfL Unified API** | Transport for London's open API | London transit: live arrivals, line status, journey planner (P8) + feeds disruption (P9–P10) | **Free** | `TFL_APP_KEY` | Register at api-portal.tfl.gov.uk → paste the key |
| **AeroDataBox** | Flight-status data (RapidAPI / API.Market) | Live gate/terminal → the gate-change reroute rule (P13) | **Low-cost paid** — RapidAPI basic ≈ $0.99/mo (small/trial quota; ~7-day trial); ~$5/mo for 3k calls; genuinely-free 300–600/mo tier only via **API.Market**. **No truly-free generous flight-gate feed exists.** | `AERODATABOX_KEY` | Subscribe (API.Market free tier, or RapidAPI ~$5/mo for real volume) → paste the key |

## C · Free software, but you host it (infrastructure)

| Provider | Who / what | Powers | Cost | Env | Action |
|---|---|---|---|---|---|
| **OpenTripPlanner (OTP)** | Open-source journey planner, self-hosted | Cross-network *detour* routes when a line is blocked (P11 recovery) | Free OSS + ~£20–50/mo server | `OTP_URL` | **PARKED (D49)** — stand up a JVM when traffic justifies; runbook: `docs/otp-self-hosting.md` |
| **Valhalla / Photon** | Open-source routing + geocoding | The owned A→B nav stack | Free; public instances are fair-use | `VALHALLA_URL` / `PHOTON_URL` | Self-host before real traffic (currently on public instances) |

## D · Commercial relationships — apply, may take weeks, you earn revenue

These are revenue providers: the supplier collects the customer's money and you take a commission or a
margin. They need a B2B application/contract, so **start these early** if you want the feature live.

| Provider | Who / what | Powers | Cost model | Env | Action |
|---|---|---|---|---|---|
| **DragonPass** | Airport-experience network — **active partner (decision #1)** | Fast-track security (P12) + airport lounge (P13) | Revenue (commission / wholesale+markup) | `DRAGONPASS_KEY` | Apply to DragonPass — the achievable short-term contract |
| **Collinson** (Priority Pass + SmartDelay) | Same space — **long-term strategic target (dormant)** | Future: lounge + fast-track + SmartDelay (delay-triggered lounge → recovery) | Revenue | `COLLINSON_KEY` | Pursue the enterprise relationship over time; adapter is ready |
| **Parkopedia / Arrive** | Parking data + booking aggregator | Predicted car-park occupancy + reserve a space (P13) | Low/revenue (data licence + booking commission) | `PARKOPEDIA_KEY` | Apply for API access |

### Phase 14 booking partners — status (founder, 2026-06-14)
The connections/booking framework (P14) is built against **real provider contracts**, env-gated, with
mocks behind the same interface until each is live. Current procurement status:

| Provider | For | Status | Env | Notes |
|---|---|---|---|---|
| **Duffel — Flights** | Flight search + fares + book (test mode) | ✅ **test API key in hand** — the live validation connector | `DUFFEL_API_TOKEN` | `duffel_test_…` token routes to test env (no real money). Set it in Vercel — never in chat. |
| **Duffel — Stays** | Hotel search + book | ⏳ **pending Duffel sales activation** (Stays is sales-gated) | `DUFFEL_API_TOKEN` | Same provider/token; built real-shaped, lights up when Stays is enabled on the account. |
| **Parkopedia / Arrive** | Parking occupancy + reserve | ⏳ **email sent**, awaiting reply | `PARKOPEDIA_KEY` | Mock in place (P13), real-shaped. |
| **Assertis** | **Rail booking / retailing** (purchase e-tickets — complements Darwin's live times) | ⏳ **email sent**, awaiting reply | `ASSERTIS_KEY` | Rail *purchase* layer; until live, rail fares are display-only / referred. |

### Coming up (later phases — listed so you can start slow ones early)
- **Booking.com Demand** (hotels, alt to Duffel Stays) — *weeks to approve;* Duffel Stays is the primary path.
- **Collinson SmartDelay** (lounge auto-granted on a flight delay — a disruption-moment revenue line for
  the recovery layer) — comes with the Collinson relationship (decision #1's long-term target).
- **Airalo** (eSIM, P19), **FX feed** (P19), **Xero/QuickBooks** (accounting export, post-P16).

---

## Decisions you need to make

### 1. Airport-experience partner — **DECIDED: DragonPass now, Collinson the long-term target** (founder, 2026-06-14)
Both do lounges *and* fast-track; one partner, not two. **Ship on DragonPass** as the practical
**short-term** partner — one contract covering both fast-track (P12) and lounge (P13), with achievable
onboarding for a young company. The build routes **both** rules through `integrations/dragonpass.ts` on
`DRAGONPASS_KEY`.
- **Collinson is the long-term strategic, enterprise-level *target*** — the bigger lounge network +
  **SmartDelay** (lounge auto-triggered by a flight delay → plugs straight into the recovery moment) +
  meet-and-assist — but it's **not a short-term solution**, so it's kept **dormant**
  (`integrations/collinson.ts`, ready, unimported). Switching to it when that relationship lands is a
  one-line change (identical voucher shapes). `COLLINSON_KEY` is the dormant/future env.

### 2. Open-Meteo: commercial plan or self-host
Open-Meteo is free for **non-commercial** use. Khonsera is commercial, so for production you need
either their **paid API plan** (cheap) or to **self-host** their open-source server. Trivial change
(`OPEN_METEO_URL`), but a real licensing line to close before launch.

### 3. Parkopedia commercial terms
Parking is a "low/revenue" provider — confirm whether you want the data-only tier (occupancy for the
nudge) or the full reserve-and-pay tier (which also feeds the P14 booking framework).

---

## What each provides and *why* (one line each)
- **Darwin** — *why:* the day can't react to a delay it can't see; this is the live rail truth. **Free.**
- **TfL** — *why:* London is a huge share of UK travel days; without it the city legs are blind. **Free.**
- **Open-Meteo** — *why:* "leave 15 min earlier, it's about to pour" is foresight you can't fake. **~Free.**
- **AeroDataBox** — *why:* a gate change you find out about late is a missed flight. **~$5/mo (cheapest gate feed; no free generous option).**
- **OTP** — *why:* when the line itself is blocked, the answer isn't "next train", it's "another way". **Self-host.**
- **DragonPass/Collinson** — *why:* thin buffer → fast-track saves the flight; long wait → a lounge. **Revenue.**
- **Parkopedia** — *why:* "the car park will be full" the day before beats circling it on the day. **Revenue.**
