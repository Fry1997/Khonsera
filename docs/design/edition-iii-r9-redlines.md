# Khonsera — Edition III · Connections / booking redlines (P14)

**Design → Code.** Companion to `khonsera-edition-iii-connections.css` (additive; import **last**,
after `khonsera-edition-iii-care.css`). Skins the ConnectionsFinder by contract name — no
markup/JS/class changes, tokens only, globals.css untouched. View: `screens/Connections.html`.

## The intent
The "buy without leaving Khonsera" moment — search → compare → book, for flights and stays, on
`/plan/[id]`. **A considered desk, not a search engine.** The comparison must be legible at a glance;
the calm of the rest of the app carries into the transaction. Concierge restraint throughout.

## Shell (`.cc-conn`, `-head`, `-tabs`, `-tab`, `-sample`, `-close`)
Opens as a calm panel in the action row — a `--card` surface, 10px radius, soft shadow; **not a modal
takeover.** Flights|Stays as a pill segmented control (`-tab[data-active]`); the **"· sample"** honesty
cue sits quiet in the head whenever a provider is mocked; a discreet close at the right.

## Search form (`.cc-conn-form`, `-field`, `-lbl`, `-near`)
One calm row. Flight: From/To **IATA** fields (mono, uppercase, fixed narrow width) + date. Stay:
"Near {place}" (flexible width) + check-in/out. Mono-caps labels; the Search action is the one gold
fill. Reuses `.cc-field` + `.cc-btn`.

## Compare list (`.cc-conn-list`, `-offer`, `-offer-main/-title/-op/-summary/-fare/-right/-price/-action`)
**One fare/stay per row, scannable.** The title (carrier/hotel) is Satoshi; the operator/IATA badge is
quiet mono. The **summary line is the mono spine** — times, stops, duration (flights) or rating · walk ·
board (stays). **Direct reads sage** (`.stops[data-direct="true"]`) — a quiet relief, the one place the
fare list earns colour; stops/layovers stay ink-dim. Fare brand (Economy/flexible) is faint mono. On
the right, **price is the dominant mono figure** + one action. One primary `Select` per row; a
secondary/pricier option may use `data-variant="quiet"`. Row hover warms to `--sand`. Stays show the
price with a `/ night` `.per`.

## Passenger capture (`.cc-conn-pax`, `-lead/-note/-grid/-actions/-confirm/-back/-secure`)
The step before a flight order — **unhurried, considered; a clean form, not a checkout wall.** Lead row:
"Who's travelling?" + the chosen fare summary (mono, right). A Spectral-italic reassurance note ("just
what the airline needs"). A 2-col grid of `.cc-field`s (title/name/DOB/gender/email/phone; email spans
2). Actions: the gold **Confirm — £price** (price mono), a quiet Back, and a faint "Secured by Duffel"
trust cue pushed right.

## States
- **Confirmed** (`.cc-conn-confirmed`, `-mark/-title/-detail/-tail`) — the booked moment: a sage ✓
  circle, Satoshi title ("Booked — easyJet to Edinburgh"), the detail with the mono `.ref`, and a quiet
  tail ("Added to your day · pass in Wallet"). Calm, final; it lands in the day.
- **Error** (`.cc-conn-error`) — rust-2 wash, a rust dot, the cause in a rust `<strong>` then the
  reassuring next-best **in ink**. Carries consequence, never a klaxon.
- **Pending** (`.cc-conn-pending`) — gold-tint (informational, not failure): "Stays not activated —
  showing representative results" + a `.sample` cue. Gold, because it's an honest "not live yet", not an
  error.
- **Empty** (`.cc-conn-empty`) — a single calm Spectral-italic line + a quiet mono hint ("Try a day
  either side"). Never a dead panel.

## Restraint check
One gold fill per surface (the search/confirm action). Price always mono. Direct = sage relief; rust
only on a genuine error. The "· sample" cue legible but secondary; it disappears when the real key
flows. No emoji. The transaction feels as calm as the plan it sits on.
