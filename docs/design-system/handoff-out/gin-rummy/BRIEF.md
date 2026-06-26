# Design Brief — Khonsera Gin Rummy (online, 2-player)

**A Code → Design handoff.** The rules engine and the multiplayer data model are
built; this brief is the lingua-franca artifact (per the Design↔Code Handoff
Protocol) so Claude Design can design the screens against the **real data and
states**, reusing what already exists. Repo: `Fry1997/Khonsera`.

---

## 1. What it is

Gin Rummy is the first **online multiplayer** game in **Pastimes** (Khonsera's calm
downtime corner — a wholesome alternative to doom-scrolling for travellers). You
play with **someone you know**: you connect once (a couple, two colleagues), then
either can invite the other to a table. It is **turn-based**, so it tolerates patchy
train signal, and a dropped player **rejoins and resumes** — the table is never lost.

Not matchmaking. Not real-time twitch. Two known people, a quiet hand of cards.

---

## 2. What ALREADY EXISTS — reuse, do not redesign

- **The playing-card asset** (`src/components/solitaire/playing-card.tsx` + `.css`).
  Cotton-stock face, woven-linen tooth beneath the ink, colour blind-deboss pips,
  `--cw`-driven scaling (one number sizes the whole card; height = `--cw × 1.4`).
  **Render any card as `<PlayingCard rank suit faceDown? />`.** Design the *table and
  hand*, not the card face — it's done and is the family signature.
- **The paper material / v7 direction** (`docs/design-system/handoff-v7/`): cotton
  stock, letterpress-debossed ink, charcoal blocks as "the same stock in black",
  **gold as muted brass punctuation only — never a fill**. Satoshi + JetBrains Mono.
- **Pastimes hub + the felt table** — Solitaire already establishes a **deep ink-felt
  table** (`src/components/solitaire/solitaire.css`) on the dark direction, with a
  sunken-plaque HUD (Moves/Time/Score) and raised tool buttons. Gin Rummy should feel
  like a sibling on that same felt unless you propose otherwise (see open questions).
- **The Gin Rummy rules engine** — `src/lib/games/gin-rummy/` (pure, 53 tests). It owns
  all rules/scoring; the UI only renders state + sends moves. **Design to its contract
  (§4).**
- **The multiplayer model** — `supabase/migrations/0056…`: a connection links two
  users; a durable `game_rooms` row holds the serialised state (rejoin-and-resume),
  whose turn it is, and presence. Turns are server-validated.

## 3. What DESIGN owns (this brief)

The **screens and states** for: the **connections/players** area in Pastimes, the
**connect + invite + lobby** flow, the **Gin Rummy table** (the hero), **round-over**
and **game-over**, and every **multiplayer/connection state** (your-turn, their-turn,
reconnecting, opponent-left, errors).

---

## 4. The data contract (design to THIS)

The engine state is one serialisable object. Every screen binds to it — these are
real props, not placeholder text.

```ts
GinState {
  scores: [number, number]   // cumulative game score, [you, them]
  target: number             // first to this wins (default 100)
  round: number              // 0-based round counter
  dealer: 0 | 1
  turn: 0 | 1                // whose move it is
  phase: 'upcardNonDealer' | 'upcardDealer' | 'draw' | 'discard' | 'roundOver' | 'gameOver'
  stock:   Card[]            // face-down draw pile (show as a count + a back)
  discard: Card[]            // face-up pile; TOP = last element
  hands:   [Card[], Card[]]  // your hand is yours in full; the opponent's is a COUNT only
  lastRound: RoundResult | null
  winner: 0 | 1 | null
}
Card = { rank: 1..13, suit: 'S'|'H'|'D'|'C' }   // 1 = Ace … 13 = King
```

A move the UI can offer (the engine says which are legal each turn via `legalMoves`):

```ts
Move = { type:'drawStock' } | { type:'drawDiscard' }
     | { type:'discard'; card } | { type:'knock'; card } | { type:'passUpcard' }
```

Melds + deadwood for the **your-hand** read-out (`meldsAndDeadwood(hand)`):

```ts
{ melds: Card[][]     // sets (3-4 of a kind) + runs (3+ same-suit sequence)
  deadwood: Card[]    // leftover unmelded cards
  deadwoodValue: number }   // points of the deadwood (A=1, face=10); KNOCK allowed at ≤ 10, GIN at 0
```

Round resolution (drives the round-over reveal):

```ts
RoundResult {
  kind: 'knock' | 'gin' | 'undercut' | 'wash'
  knocker: 0 | 1 | null
  points: number; scorer: 'knocker' | 'opponent'
  knockerDeadwood: number; opponentDeadwood: number
  laidOff: Card[]   // opponent's cards laid off onto the knocker's melds (none on gin)
}
```

**Plain-language gloss for the screens:**
- A turn is **draw → discard**. Draw from the **stock** (unknown) or take the **face-up
  top of discard** (known). Then discard one. The opening has a one-off **upcard offer**
  (`passUpcard`).
- **Knock** = end the hand when your unmatched **deadwood ≤ 10**. **Gin** = all 10 cards
  melded (deadwood 0) → +25. After a knock (not gin) the opponent **lays off** spare
  cards onto your melds; if their deadwood ends ≤ yours it's an **undercut** (they score
  + 25). **Wash** = stock ran out with no knock → redeal.
- Scores accumulate over rounds to **target** (default 100).

---

## 5. Screens & components — each with **Data** and **States**

### 5.1 Players (in Pastimes) — the connections home
**Data:** your connected people (name, online/offline), pending requests (incoming vs
outgoing), your own **connect code** to share, a field to enter someone's code.
**States:** `empty` (no one yet — lead with "Connect with someone you know" + your
code) · `list` (people, online dot, an **Invite to Gin Rummy** action per person) ·
`incoming request` (accept / ignore) · `outgoing pending` (waiting). Calm; presence is
a quiet dot, not a flashing badge.

### 5.2 Connect flow
**Data:** your shareable code (+ a copy/share affordance), an enter-a-code field.
**States:** `share` · `entering` · `sent` (request pending) · `error` ("No one uses
that code"). Friendly, low-ceremony — this is two people who know each other.

### 5.3 Invite & lobby (table not yet started)
**Data:** the two players (you + invitee), who's host, ready state, the game (Gin
Rummy), target score.
**States:** `inviting` (you opened a table, waiting for them) · `invited` (you received
one — Join / Decline) · `both ready` (deal imminent) · `opponent declined / left`.

### 5.4 The table — THE HERO
The playable surface. **Data** (from `GinState`): your hand (10–11 `Card`s), opponent's
hand as a **face-down count**, the **stock** (count + a back) and **discard** (face-up
top), the **scoreline** (you / them / target), **whose turn**, your live **deadwood
value** + meld grouping, and the legal actions this turn.
**Anatomy to design:**
- **Opponent zone** (top): name + presence dot, their card **count** (fanned backs), and
  *what they just did* on their turn (drew stock/discard, discarded X) — the turn-reveal.
- **Centre**: the **stock** (draw) and **discard** (face-up top) side by side — the two
  draw sources, clearly distinct (one unknown, one known).
- **Your hand** (bottom): your 10–11 cards, **arrangeable**, ideally auto-grouped into
  **melds vs deadwood** with a quiet **deadwood: N** read-out (turns confident as it
  approaches the knock line). Selecting a card to **discard**; a clear **Knock / Gin**
  affordance that only lights when legal (deadwood ≤ 10 / = 0).
- **Turn state** front-and-centre: it's unmistakably *your move* or *theirs*.
**States:** `your turn · draw` · `your turn · discard` · `their turn` (waiting; show
their last action) · `upcard offer` (opening: take the upcard or pass) · `can knock`
(the affordance lights) · `gin` (special) · `illegal/blocked` (gentle, e.g. you can't
knock yet). Per the Solitaire learning: **cards need room — design portrait AND
landscape** (a 10–13-card hand is wide; landscape gives big cards).

### 5.5 Round over
**Data:** `RoundResult` — kind (knock/gin/undercut/wash), both hands revealed with melds
laid out, the knocker's melds + the opponent's **lay-offs**, the points and who scored,
the new running totals.
**States:** `knock` · `gin` (a touch more celebratory, still quiet — no confetti) ·
`undercut` (the opponent's quiet turn-of-fortune) · `wash` (flat, "redeal"). Then **Next
hand**.

### 5.6 Game over
**Data:** winner, final scores, the journey (rounds). **States:** `you won` · `they won`
— quiet and gracious (mirror Solitaire's "Day complete." restraint). A **Rematch** action.

### 5.7 Connection / resilience states (cross-cutting — design these explicitly)
Travellers lose signal; the model is built to survive it, so the UI must *speak* it
calmly:
- **Reconnecting** — you dropped; we're resuming. Then **resumed** (back to the exact
  table). Not an error — a reassurance.
- **Opponent offline / reconnecting** — they dropped; their turn waits. A quiet "waiting
  for {name}" — not an alarm.
- **Opponent left / abandoned** — the table ended; gracious exit + rematch offer.
- **Stale / no signal on your turn** — you can still *see* the table (last-known); the
  send is queued/blocked with an honest line.

---

## 6. Interactions
- **Draw**: tap stock OR the discard top (two distinct sources). **Discard**: pick a card
  from your hand. **Knock/Gin**: a deliberate action, only enabled when legal.
- **Arrange the hand**: let the player order cards; auto-suggest the optimal meld grouping
  (the engine computes it) but don't force it.
- **Turn handoff**: when it becomes your turn, surface *what the opponent did* (their draw
  source + discard) so the state is legible without having watched.
- Reuse `.btn` / pill / tool idioms from the system; **press = translateY(1px)**, no bounce.

## 7. Voice & brand (non-negotiable)
- Speaks as **Khonsera** — calm, precise, never chatty, **never a human name**. **No emoji,
  ever.** Times/scores/counts in **mono**. Sentence case; UPPERCASE only for mono eyebrows.
- **Gold is punctuation** (the live turn, one accent) — never a button fill. Charcoal block
  is the lead action. Calm by default; the only urgency is *your move*.
- Mobile-first; **portrait + landscape both first-class** (the hand is wide — see §5.4).

## 8. Open questions for Design (your call — note your choice)
1. **Felt or paper?** Share Solitaire's deep ink-felt table, or set Gin Rummy on the app's
   cotton-paper? (Felt reads as "a game"; paper reads as "part of Khonsera". Recommend felt
   for continuity, but your call.)
2. **Meld grouping** — auto-group the hand into melds/deadwood, manual, or both?
3. **Hand layout under pressure** — 10–13 cards on a phone: fan, wrap, scroll, or
   landscape-primary? (We hit exactly this on Solitaire — landscape gives big cards.)
4. **The deadwood read-out** — how loud? It's the core tension; a quiet confident number
   vs a more present meter.
5. **Opponent turn-reveal** — how much to animate their move vs state it.

## 9. Where to look (the contract, in-repo)
- Engine + types: `src/lib/games/gin-rummy/` (start at `index.ts`, then `engine.ts`).
- Card component: `src/components/solitaire/playing-card.tsx`.
- The felt + HUD idiom: `src/components/solitaire/solitaire.css`.
- Material + tokens: `docs/design-system/handoff-v7/` (HANDOFF.md, primitives.css).
- Multiplayer data model: `supabase/migrations/0056_pastimes_multiplayer_foundation.sql`.

Deliver: the screens in §5 with their states drawn, plus your answers to §8 — in the v7
paper/felt material, to the data in §4. Code wires it to the live engine + realtime.
