# Khonsera — Edition III · Live spine redlines (P8–P10)

**Design → Code.** Companion to `khonsera-edition-iii-live.css` (additive; import **last**, after
`khonsera-edition-iii.css`). Skins the live-data layer by contract name — no markup/JS/class-name
changes, tokens only, globals.css untouched. View: `screens/Live-spine.html`.

## The governing rule (whole family)
**Calm caution that carries consequence — never alarm.** One tone ramp across every component:
`good/info → sage` · `minor/late/advise → gold` · `warn → amber` · `severe/suspended → rust` (the one
salt; no pulse, no red-alert). **The consequence sentence always reads in ink** — the fact stays calm;
only the small status chip carries colour. Keep the **"· sample"** honesty cue on mocked data.

## P8 · TflLineStatus (`.cc-tfl`)
A quiet board, not an alarm panel. Disrupted lines lead: name (Satoshi) + mono status (gold/rust) +
reason in **ink**. The remainder is withheld to one Spectral-italic line ("Everything else is running
well"). All-clear = a single calm line with a sage dot. Dot ramp via `.cc-tfl-line[data-state]`.

## P8 · TflLegPlan (`.cc-tflleg`)
Beneath a London transit leg: the **route** reads as a sequence (walk → line → walk, per-step mono
minutes); **arrivals** are a quiet mono ticker, the next train tinted gold. P9 disruption:
`[data-disrupted]` warms the left border (gold; rust at severe), and `.cc-tflleg-alert[data-state]`
shows the line status (mono chip) + the **consequence in ink**. The reroute offer
(`.cc-tflleg-reroute`) is an understated mono underline — an offered way out, never a shout.

## P9 · Decision-clock (`.cc-decision-clock`)
The day's single reassuring number. A calm sand panel: mono-caps label + a **mono gold figure** + the
"for X" in ink. It must read as reassurance — the opposite of an alarm.

## P9 · Rail live-alert (`.cc-live-alert[data-state]`)
Under a booked train leg. `minor` = gold-tint + gold left-edge; `severe` = rust-2 + rust left-edge.
Title is a mono status chip; the **consequence + act-by** read in ink, the act-by mono-underlined. Calm
caution carrying consequence — no panic.

## P10 · Fragility line (`.cc-fragility`)
Near the clock. A rust dot + "**Tight plan** — only N min of slack… add a buffer while you can." No
fill — just the steady warning and the gold offer to fix it. Foresight, not alarm: it lets you act
*before* it breaks.

## P10 · Day ripple (`.cc-day-ripple`)
Above the per-leg alerts. The whole-day cascade at a glance — rust-2 panel, the cascade fact in ink
with the minutes mono. Present, a touch of weight, still calm; it's the day-level summary that sits
over the individual leg alerts.

## P10 · Today disruption banner (`.cc-today-disruption[data-severe]`)
The day's whole character shifting. It **commands the screen** — `.cc-screen[data-disrupted]` fades
the surrounding surfaces to ~0.62 so the banner leads — yet stays the calm chief-of-staff. Top accent
border (gold / rust at severe), mono eyebrow, Satoshi title stating the fact, an item line with the
**re-plan already found**, then a gold (rust at severe) primary action + a quiet "Talk to me". `severe`
= rust, `late` = gold. It re-plans *for* you; it never just raises an alarm.

## Restraint check
Rust appears only at genuine severe/suspended. Every consequence sentence is ink, not coloured. One
primary action per disruption. No emoji, no pulsing, no red. The concierge is steady precisely when
the day isn't.
