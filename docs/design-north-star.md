# Khonsera — Design North Star

**This is the soul of the design system. Read it before `design-tokens.md` and
`component-contract.md`. When the codebase says two things at once (old vs new),
*this* is the tie-breaker. Both Claude Code and Claude Design re-ground here.**

## The idea
A stub of paper can hold a memory — a flight, a meeting, a day someone cared
about. It is **not ours to assume** whose budget ticket was "just" a budget
ticket. So in Khonsera, **everything deserves to feel real, premium, and worth
keeping.** Why shouldn't it?

It began as a **debossed business card on heavy cotton stock**. The more the look
was *felt*, the more every card wanted to be cotton and pressed — until the
end-state became clear:

> **The whole app is one physical material — texture and layers you could run
> your finger over and actually feel.** Tactile. Physical. Premium by default.

## The test (how to know it's right)
**The finger test.** Could you run your finger over this surface and *feel* it —
the deboss, the fibre, the layer? 
- Reads as **pressed, textured, layered cotton** → it's the new language. ✅
- Reads as a **flat web element** (a plain card, a flat button, a bordered box)
  → it's old, and not done. ❌

This is also the **old/new tie-breaker** for the whole codebase: anything that
doesn't pass the finger test is legacy — to be brought into the material
language or removed. There is no third aesthetic.

## The design laws (what the test means in practice)
1. **One material — cotton card stock.** Every surface is the same warm heavy
   paper (the `--ground / --screen / --widget / --well` family). Features differ
   by **how they're pressed into it**, not by colour.
2. **Depth by press, not by border.** Raised faces (`--lift`) and pressed wells
   (`--sink`) — letterpress, not flat outlines. A divider is a hairline pressed
   into the stock, not a 1px box.
3. **Texture is real.** The cotton has fibre (`--fibre`); surfaces aren't dead
   flat. You can sense the grain.
4. **Layers stack.** Material on material (widget on screen on ground), each with
   its own press and shadow, so the eye reads physical depth.
5. **Charcoal ink, letterpress.** Type sits *in* the stock like print
   (`--char / --ink`), with the engrave/emboss treatment, never floating.
6. **Gold is punctuation.** `--gold` is the one foil accent — a pressed dot, a
   single mark — **never a fill**. Used once per composition, if at all.
7. **Premium by default.** No surface gets the "it's only a budget thing"
   treatment. The humblest ticket, expense row, or empty state is rendered with
   the same care as the hero. The point is to make the mundane feel kept.
8. **No emoji, ever.** (Existing rule; restated because it breaks the material.)

## What this makes "new" vs "old"
- **New:** the cotton / heavy-paper material — pressed wells, raised cards, fibre
  texture, letterpress ink, gold-as-punctuation, layered depth. (Edition III
  `.cc-*` shell + the cotton tokens are largely already this.)
- **Old:** anything flat / generic / un-pressed — the Edition II shell, plain
  web cards and buttons, bordered boxes, retired theme/class families. These
  fail the finger test and are on the path to removal.

## Why this exists
The design system had accreted multiple *eras* that physically coexist (look at
the `edition-ii` / `edition-iii` CSS files, the stacked theme names, the mixed
`.cc-*` / `.brief-*` / `.k-*` / `.j-*` class families). With no single
definition of "current," both Code and Design pattern-matched the muddle. This
doc is the cure: one emotional, testable definition of the target, so the
reconciliation audit can mark everything CURRENT / LEGACY against the finger
test, and the legacy can be stripped until only the material language remains.
