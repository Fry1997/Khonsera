# Khonsera — Edition III · Deviation & care redlines (P11–P13)

**Design → Code.** Companion to `khonsera-edition-iii-care.css` (additive; import **last**, after
`khonsera-edition-iii-live.css`). Skins the deviation/care layer by contract name — no markup/JS/class
changes, tokens only, globals.css untouched. View: `screens/Deviation-and-care.html`.

## The two axes (the whole point)
1. **Severity — calm caution carrying consequence, never alarm.** Rust appears only at genuine cost.
   The consequence **sentence always lands in ink**; the reassuring way-out reads **sage**; the misses
   stay quiet ink-dim, **never red**.
2. **Foresight vs reaction.** *Looking ahead* (the nudges) is an unhurried gold-tint hand on the
   shoulder, marked with a **hollow** dot. *The moment-of* (recovery band, gate-change) carries a touch
   more weight — a 2px edge, a **filled** dot — still composed. Once acted, a nudge **settles** into a
   quiet confirmation, not a trophy.

## P11 · RecoveryCard (`.cc-recovery`)
The way out when a booked train is cancelled/severely delayed. Rust left-edge marks the break; mono
rust eyebrow; the framing note in Spectral italic ("the trade-off — choose your priority"). Each
`.cc-recovery-opt` is a glanceable row: mono **label** (time-pair / mode) + **consequence in ink**.
- `data-makes="true"` → the reassuring one: sage label + a sage ✓, a sage-tinted border. It should feel
  like relief.
- `data-makes="false"` → quiet: ink-dim label, consequence in ink-2. Never red.
- **Return-pairing** (`.cc-recovery-return`, heaviest cost): a rust-dotted line; at `data-return="at-risk"`
  the "the trip's lost" reads in ink with a rust `<strong>`. The real cost, stated plainly — no klaxon.
- **Detour via** (`.cc-recovery-via`): faint mono, the *how* beneath the *when* — secondary.
- Keep the **"· sample"** cue while the provider is mocked.

## P12/P13 · Contextual nudges — two states cover all six rules
**Open foresight** (`.cc-nudge` / `.NudgeCard` in `.cc-nudges`): gold-tint card, a hollow-dot
**"Looking ahead"** mark, the proposal in ink (place names medium-weight), a gold primary action + a
quiet "Not now". Unhurried. Six rules flow through this one card — weather, lounge, parking, fast-track
(+ the recovery notes); only the copy changes.
**Reaction** (`.cc-nudge[data-urgency="now"]`, the gate-change): same card, a **2px gold left-edge** and
a **filled "Now"** mark — a touch more weight, still gold (it's "handle this now", not a failure → never
rust). "Working…" = the gold button at `[data-busy]`/`[disabled]`.
**Accepted** (`.cc-nudge-done`): it **settles, doesn't vanish** — a recessed `--card-2` panel, a small
sage ✓ mark, the confirmation in ink-2 with a medium `<strong>`, and a quiet mono tail
("Added to today · 06:40 set-off"). Present, final, not a trophy.

## Restraint check
Rust only at genuine severity (the break, the lost return). Every consequence sentence in ink. Sage =
relief, never decoration. One primary action per card. Hollow dot = ahead, filled = now. No emoji, no
pulsing, no red-alert. The chief-of-staff is steady — looking ahead calmly, handling the moment without
panic, and remembering the call once it's made.
