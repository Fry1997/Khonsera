# SCREEN SPEC — APP SHELL / CHROME  (highest priority)

The frame that wraps every in-app screen: the **header**, the **bottom bar**, the **mode toggle**,
and (desktop) the **rail**. Round 1 designed the bottom bar (`.cc-tabbar`) and the mode switch
(`.cc-modeswitch`) in isolation, but never the **header** or how the pieces sit together. That gap is
the mess in `current-state/01-today-and-topbar.jpeg`.

## What's wrong right now (see current-state/01)

- The **wordmark truncates** — it reads "KHONSER" (clipped). The emblem is tiny/unclear next to it.
- The header is a **pile-up**: emblem + wordmark + a wide PERSONAL/WORK pill + "Demo off" + a gold
  "Tell" button + a hamburger — five things fighting for ~390px. The mode toggle crowds the logo.
- No clear hierarchy; it doesn't read as Edition II. Code's current rebuild is a stopgap guess —
  **please define this properly.**

## What the shell must contain (and decisions for you to make)

**Header (the band at the top of every screen).** Elements that need a home + rules:
- **Emblem + wordmark lockup** (`reference/brand/mk-ink.png` + "KHONSERA" in Satoshi). How big? Does
  the wordmark show on 390 at all, or emblem-only on mobile and full lockup on desktop? It must never clip.
- **Mode toggle** (`.cc-modeswitch`, Personal | Work). Where does it live at each size — in the header,
  or moved out (e.g. into a profile sheet) on mobile to de-clutter? It must not crowd the logo.
- **Actions:** "Tell" (the capture entry — note the Planner already has a sticky capture field, so Tell
  may not need to be a header button) and an **overflow/profile** affordance for the secondary
  destinations (Expenses · Workspace · Settings · sign out) + the staff-only "Demo" toggle (staff only;
  hide for everyone else). Decide what's a header action vs what lives in an overflow sheet.

**Bottom bar (mobile).** `.cc-tabbar` (Today · Plan · Tasks · People→Clients in Work mode), **fixed**
to the bottom with safe-area inset; active tab in gold-2 + the dot. Round 1 styled it — please
confirm it in *context* (against a real screen, with the header), since the user flagged it too.

**Desktop rail (1280).** Round 1 said "the shell may add a quiet left rail for nav + the mode toggle."
Design it: the rail's width, the nav list, where the lockup + mode toggle + overflow sit, and confirm
the content column stays centred (~600px) — Today/Plan never become multi-column.

## States to design (× 390 / 744 / 1280)

1. **Default** — header + a representative screen (use Today or Plan) + bottom bar/rail.
2. **Work vs Personal** — the toggle state + the People→Clients label swap in the bar.
3. **Overflow open** — the profile/more sheet (Tell, Expenses, Workspace, Settings, sign out).
4. **Scrolled** — header behaviour on scroll (does it stay, shrink, hairline?).

## Data the shell reads (already available)

- `activeMode` (`work | personal`) — drives the toggle + the People/Clients label.
- `email` / first name, `isStaff` (gates the Demo toggle), workspace name (Work mode).
- The current route (active tab).

## What to return for the shell

The header + bottom bar + desktop rail designed at all three sizes; the additive CSS styling them by
class (`.cc-tabbar`/`.cc-tab`/`.cc-modeswitch` already exist — extend; add the header classes you
need, e.g. `.cc-appbar`, `.cc-lockup`, `.cc-overflow`); a class/`data-*` map; redlines (the lockup
sizing rules that stop the truncation, the toggle placement per size, spacing, safe-area). **One
gold fill, one accent. Calm.**
