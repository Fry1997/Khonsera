# Current state — what's wrong (the actual live app)

These are screenshots of the **deployed** app, so Design sees reality, not a mock.

## 01-today-and-topbar.jpeg → see `screen-specs/app-shell.md`
- **Header is broken:** wordmark clips to "KHONSER"; emblem tiny/unclear; mode toggle + "Demo off" +
  "Tell" + hamburger all crammed across ~390px — the toggle crowds the logo.
- Bottom bar (Today · Plan · Tasks · People) is the new 4-item nav, but flagged for review *in context*.
- The Today empty state itself ("Right now / Nothing live right now / Plan a journey") is roughly
  right (Edition II colour), but the **chrome around it is un-designed**.

## 02-landing-OLD-brand.jpeg → see `screen-specs/landing.md`
- Entirely the **retired brand**: the crescent moon emblem (must not exist), "KHONSU · SERA" eyebrow,
  the cross divider, the four gold-ring icons, serif-italic blurb. Needs a full Edition II redesign.

## 03-login.png → see `screen-specs/auth.md`
- Old emblem + a generic form; not on the Edition II auth template.

## The single root cause
Round 1 only designed **Planner + Today + the bottom nav**. The **shell/header, landing, auth, and the
secondary screens were never designed** — so Code guessed, and the guesses look off-brand. This pack
closes that gap. Once it's designed, Code implements on live data, reaches parity, and strips the legacy.
