# Breakpoints — mobile-first (three sizes)

Design every screen/state at these three widths. **Mobile is the base**; larger sizes are
enhancements, never the source of truth.

| Name | Width | Notes |
|------|-------|-------|
| **Mobile** | **390 px** | The base. Single column. Primary nav = bottom bar (Today · Plan · Tasks · People). `ComparisonMatrix` is a focused sheet/overlay. Sticky plain-language input on Plan. |
| **Tablet** | **744 px** | Single column stays centred with wider margins; **do not** introduce a dashboard grid. Extra space → breathing room. |
| **Desktop** | **1280 px** | Spine stays centred (max content ~720px); the shell may add a quiet left rail for nav, but Today/Plan remain a single calm column. Resist multi-column sprawl. |

Rules:
- The spine (Plan) and the focal column (Today) never become multi-column dashboards at any size.
- Gold/accent is punctuation at every size — one live pulse or one action.
- Touch targets ≥ 44px; generous vertical rhythm; cards full-width on mobile.
