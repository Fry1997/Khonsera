# Khonsera — Edition III · Sharing / comms / safety redlines (P18)

**Design → Code.** Companion to `khonsera-edition-iii-sharing.css` (additive; import **last**, after
`khonsera-edition-iii-ledger.css`). Skins by contract name — no markup/JS/class changes, tokens only,
globals.css untouched. View: `screens/Sharing.html`.

## The rule
**Trust + control.** Sharing reads calm and **obviously revocable**; the **"your workspace sees status
+ ETA, never your live location"** guarantee is stated **plainly, not buried**. Gold = the one share
action; rust only on stop/revoke + a genuine error; sage = a safe/active confirmation. As warm and
reassuring as a text to someone who loves you.

## ShareControl (`.cc-share*`) · `/plan/[id]`
- **Compose** (`.cc-share-tell`): Running late / Arrived safely / On my way as soft pill buttons → the
  OS share sheet. "Arrived safely" carries the sage tone (`data-tone="safe"`); the rest stay neutral.
- **The employer guarantee** (`.cc-share-employer`): a quiet shielded line, the promise in ink with
  **"never your live location"** emphasised. Plainly stated — this is the trust anchor.
- **The live-location gift** (`.cc-share-live`): a Spectral-italic framing ("a warm thing to give
  someone… stop any time"), a recipient field + a **1h | 4h | 12h | 24h** duration toggle
  (`.cc-share-dur button[data-active]`) + the gold **Share**.
- **Broadcasting** (`.cc-share-live[data-broadcasting="true"]`): gold-tint, a gold **pulse** status
  ("Broadcasting to Sarah · until 18:40", reduced-motion gated), a quiet **Send link**, and the rust
  **Stop sharing** — the obvious off-switch.
- **Active shares** (`.cc-share-list` / `-row`): recipient + meta ("Live location · until 18:40") + a
  mono Copy-link + an **End** (rust on hover). Every share visibly endable.
- **Error** (`.cc-share-error`): rust dot + `<strong>` cause, the rest ink. Never a klaxon.

## Public recipient page (`.cc-shared*`) — standalone, NO app chrome
A page a non-user opens from a text. Design owns it end-to-end.
- **Active**: a warm top-light ground, the emblem, "Shared with you" eyebrow, a Satoshi title with a
  Spectral-italic clause ("Connor is sharing *their journey* with you."), "Updated just now" with a
  **sage live dot**, a `.cc-shared-map` (gold location pin; real MapLibre in prod), the gold **View on
  map**, and a quiet foot ("Ends 18:40 · via Khonsera").
- **Ended** (`[data-ended="true"]`): a calm full-stop — the dot greys, "This share has ended.", a
  Spectral-italic reassurance ("Connor arrived safely…"). Reads as closure, **not an error**.

## Restraint check
The guarantee is plain, never fine print. Gold = Share / View. Rust = Stop / End / error only. Sage =
arrived-safely / live-and-well. The off-switch is always in sight. The recipient page is warm and
minimal — it must reassure a stranger in three seconds. No emoji.
