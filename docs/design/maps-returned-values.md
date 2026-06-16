# Maps — returned slot values (D81–D83)

**Proof:** `Khonsera Map - Theme Proof.html` renders these exact values — same overlay on all three
basemaps + the network-mode concept. Drop the values below into
`src/components/journey-map/themes/{dusk,midnight,sahara}.ts` verbatim.

The defaults you set were sensible — outbound-gold / return-teal is the right call. My changes are
small refinements for legibility, plus **two new-slot requests** that resolve the midnight badge
ambiguity you flagged.

---

## A · Route lines — `colors` (refined)

```
# DUSK
dusk.colors.gold        = "#9c6714"   # outbound — warmed a touch off the olive cast, still dark enough for cream
dusk.colors.routeReturn = "#1d6f73"   # return — essentially your value, a hair deeper
dusk.colors.routeCasing = "rgba(20,16,10,0.62)"   # +0.07 opacity — crisper over busy roads
dusk.colors.goldGlow    = "rgba(160,117,32,0.16)" # −0.02 — the glow was competing with the casing

# MIDNIGHT
midnight.colors.gold        = "#e2ab52"   # +tiny warmth; reads as the same hue family as dusk gold
midnight.colors.routeReturn = "#5cc2cf"   # keep — excellent on dark
midnight.colors.routeCasing = "rgba(0,0,0,0.60)"  # +0.05
midnight.colors.goldGlow    = "rgba(212,160,77,0.22)" # keep

# SAHARA
sahara.colors.gold        = "#9a6815"   # keep
sahara.colors.routeReturn = "#1b6566"   # keep
sahara.colors.routeCasing = "rgba(32,24,14,0.55)" # keep
sahara.colors.goldGlow    = "rgba(168,120,38,0.18)" # keep
```

**Constraint held:** the two directions stay clearly distinct (warm vs cool), and the casing now does
the heavy lifting for route-vs-road — see the proof: both lines sit cleanly above the road network on
all three grounds.

## B · Line geometry — `geom`
Your current render values are good; **yes, please move them into `geom`** so Design owns them. Keep:
```
geom.railWidth     = 2.8   # was 2.5 — a touch more presence under the casing
geom.railGlowWidth = 9     # keep
geom.walkWidth     = 1.6   # keep ~1.5
geom.walkDash      = "2 5" # keep — reads clearly as "on foot"
geom.markerRadius  = 5     # keep
geom.originRadius  = 7     # keep
# (route line itself ~2.8 over a 5.5 casing reads best — that ratio is the thing to preserve)
```

## C · Markers & labels — `colors` + **2 NEW SLOTS**
The badge currently borrows `markerStroke` for its ground, which is why midnight inverts. **Please add
a dedicated pair** so labels are styled independently of the marker dots:

```
# NEW SLOT — labelBadge      : the badge ground (solid, sits above basemap town names)
# NEW SLOT — labelBadgeText  : the badge text

dusk.colors.labelBadge      = "#1a1612"   dusk.colors.labelBadgeText      = "#fbf8f1"
midnight.colors.labelBadge  = "#0e0b14"   midnight.colors.labelBadgeText  = "#f4e8cf"
sahara.colors.labelBadge    = "#20180e"   sahara.colors.labelBadgeText    = "#f7f0db"
```

Decision on your midnight question: **keep the badge dark-ground / light-text on all three themes**
(not inverted). A consistently dark badge is the strongest contrast against pale basemap labels and
keeps the "travel-document" feel uniform across themes. The marker DOTS keep their existing slots:

```
# unchanged
*.colors.markerFill   # destination dot / intermediate ring  (dusk #a07520 · mid #d4a04d · sah #a87826)
*.colors.markerStroke # origin bullseye ring                  (dusk #1a1612 · mid #f4e8cf · sah #20180e)
```
`labelText` (legacy bare-text) is now unused on badges — safe to leave or retire.

## D · Basemap palette — `mapStyle` (push roads back slightly)
Minor: lighten/soften the road so the route reads even at a glance. Only dusk/sahara nudged:
```
dusk.mapStyle.road       = "#fffefb"  # was #fffdf9 — a hair brighter
dusk.mapStyle.roadStroke = "#dcd2bb"  # was #d8cfb8 — slightly lighter casing
dusk.mapStyle.landEdge   = "#e7e1d0"
sahara.mapStyle.road     = "#fffdf6"
sahara.mapStyle.roadStroke = "#e2d6b4"

# MIDNIGHT — LIFT THE WHOLE BASEMAP. The old values read as near-black, so the
# route floated in a void. Brand after-dark is "aubergine-to-ink", not black —
# the streets/water/rail must be visible UNDER the route. New values:
midnight.mapStyle.water      = "#1b2f2a"  # was #16241f — a visible deep teal pool
midnight.mapStyle.land       = "#302640"  # was #241b2e — a real aubergine ground
midnight.mapStyle.landEdge   = "#3a2e4c"  # was #30263c
midnight.mapStyle.rail       = "#564a68"  # was #463b53 — rail bed reads
midnight.mapStyle.road       = "#473a58"  # was #34293f — streets now clearly visible vs land
midnight.mapStyle.roadStroke = "#372b47"  # was #241c30
midnight.mapStyle.cityLabel  = "#e8dcc6"  # was #e0d4bc — a touch brighter
midnight.mapStyle.boundary   = "#6a5e7e"  # was #544a62
# (all other water/land/rail/cityLabel/boundary slots on dusk/sahara: keep current values)
```

## E · Premium vector basemap
**Yes — flag it on for design.** Once Protomaps vector tiles are self-hosted, I want to design against
`brand-vector-theme.ts` (3D buildings + terrain + full layer control) — that's the path to the map
feeling unmistakably Khonsera rather than themed-OSM. Not blocking; queue it.

---

## ★ D83 · Underground / network modality — design direction
(Concept rendered in the proof, right-hand panels.)

1. **Honour TfL canonical line colours.** They're trusted wayfinding; rebranding them to
   dusk/midnight/sahara costs legibility for no gain. Khonsera owns the **ground, type, and the "you"
   treatment** — not the lines.
2. **Ground stays Khonsera.** Dusk cream / midnight aubergine / sahara ochre behind the canonical
   lines — ours at a glance, TfL-true where it matters.
3. **"You are here" is the single gold moment** — one gold pulse on your position; a mono
   `ALIGHT IN 4 · BRIXTON` tab as the assistant speaking. Calm, factual, never alarmist (the §rule).
4. **The transition is the USP.** Entering the Underground, the geographic map should **fold** into the
   diagram: streets desaturate and lift, lines straighten to 45°, the "you" dot travels continuously —
   one curtain-draw, ~560ms, standard ease.

**Ask back to Code:** spec the live-position + line-graph data shape (TfL line + station graph +
position feed) and I'll design the transition frames and the network-mode component against the real
data, same as any other surface.

---

### Token note
Per the protocol, these map theme objects are the **documented exception** to "tokens only" — raw hex
is correct **here**, inside these named slots only. Nothing above introduces map colours anywhere else
in the app.
