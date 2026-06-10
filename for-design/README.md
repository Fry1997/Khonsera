# for-design.zip — Code → Design

## ★ THIS ROUND (priority): the new public landing + waitlist

`/` has been rebuilt from a sign-in splash into the **public marketing front door** (what Khonsera
is + a waitlist; the app gated behind login at `/today`). It's **live and Code-built on Edition II
tokens** — the brief flags it as the **prime brand-elevation candidate**, so it goes round the loop
first. **Spec: `screen-specs/landing-marketing.md`** (this **supersedes** the old `landing.md`).
Screenshot `/` logged-out at 390/744/1280 and elevate over it. 8 states enumerated in the spec.

---

## Still outstanding from the prior round (lower priority, design when you can)

Round 1 designed **Planner** + **Today** + the bottom nav. Everything *around* them is still
un-designed, so Code has been guessing — and it shows (see `current-state/`). This pack hands you
the rest, precisely, so we stop guessing.

### What I need designed (in priority order)

1. **App shell / chrome** — `screen-specs/app-shell.md`. The header (emblem + wordmark + mode
   toggle + actions), the bottom bar in context, and the desktop rail. **This is the worst offender:**
   the wordmark truncates to "KHONSER", the mode toggle crowds the logo, and there's a stray
   "Demo off" + "Tell" + hamburger pile-up. The shell wraps *every* screen, so it sets the whole feel.
2. ~~**Landing / first-touch** — `screen-specs/landing.md`~~ **SUPERSEDED** by the new public landing
   above (`screen-specs/landing-marketing.md`). `/` is now marketing + waitlist, not a sign-in splash.
3. **Auth** — `screen-specs/auth.md`. Login / signup / forgot / reset. Still old.
4. **Secondary screens** — `screen-specs/secondary-screens.md`. Tasks · People/Clients · Expenses ·
   Settings · Workspace · Welcome (first-run). Lower craft bar than Planner/Today, but they must
   belong to the same family.

## Ground truth to design against (don't reinvent)

- `current-state/` — **screenshots of the actual live app**, annotated in the specs with what's wrong.
- `reference/design-tokens.md` — the Edition II token manifest (the values + the iron rule).
- `reference/component-contract.md` — the 13 named components (data + states); the shell composes these.
- `reference/khonsera-edition-ii.css` (brand layer) + `khonsera-edition-ii-screens.css` (the `.cc-*`
  screen components you already authored). **Extend these; same architecture.** globals.css is untouched.
- `reference/brand/mk-ink.png` (light) / `mk-brass.png` (dark) — the **only** sanctioned mark.
  The crescent/moon is retired (your own Round-1 redline) — it must not appear anywhere, incl. landing.

## Exactly what to return (`for-code.zip`)

For each spec: **all states × the three sizes (390 / 744 / 1280)**, plus:
- An **additive override CSS** that styles the shell + these screens **by class/contract name**,
  imported after the existing two layers. **Never edit globals.css.** Tokens only.
- A **class + `data-*` map** (like Round 1's `token-class-map.md`) so Code wires the exact hooks.
- **Redlines** (spacing, type, the states, mobile rules, the morph/motion where relevant).
- The **shell** especially needs: emblem size + lockup rules, where the mode toggle lives at each
  size, how actions (Tell / overflow) are reached, and the **desktop rail** layout.
- No shim/demo files in the repo set; production tokens come from the layers above.

Mobile (390) is the source of truth. Calm by default; one gold fill, one accent per view; no emojis;
copy voiced as "Khonsera". Hand it back and Code implements on live data, reaches parity, then strips
the legacy.
