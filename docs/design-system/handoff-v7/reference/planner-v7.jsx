/* ════════════════════════════════════════════════════════════════════════
 * Khonsera · Planner v6 — "Soft Widget"
 * A decisive new material language, taken straight from the reference deck:
 *   · ONE shape family — soft-extruded rounded tiles on a calm ground
 *   · charcoal is the punctuation (the NOW hero), NOT shiny gold
 *   · crisp data cells inside soft widgets (boarding-pass + wayfinding badges)
 *   · gold demoted to a single status dot
 * Planes: PAGE (ground) · WIDGET (raised) · WELL (pressed) · CHAR (charcoal).
 * Consumes window.KH_DAYS + the shared icon set.
 * ════════════════════════════════════════════════════════════════════════ */
const { useState, useEffect, useRef, useCallback } = React;

/* ── material tokens (mirror the CSS vars; one place to read the system) ─── */
const W = {
  widget: "var(--widget)", widget2: "var(--widget-2)", well: "var(--well)",
  char: "var(--char)", char2: "var(--char-2)", line: "var(--line)", lineSoft: "var(--line-soft)",
  lift: "var(--lift)", liftSm: "var(--lift-sm)", sink: "var(--sink)", liftChar: "var(--lift-char)",
  // corner family — crisp business-card stock (matches the trial's 14px sheet)
  r: { hero: 18, tile: 14, inner: 11, chip: 9, badge: 7, pill: 999 },
  // cream ink for use ON charcoal
  cream: "#f3efe6", creamDim: "rgba(243,239,230,0.62)", creamFaint: "rgba(243,239,230,0.40)",
};
window.W = W;

const MODE_ICON = { walk: "walk", car: "car", coach: "coach", eurostar: "eurostar", ferry: "ferry", taxi: "car", rail: "train" };
const MODE_WORD = { walk: "Walk", car: "Drive", coach: "Coach", eurostar: "Eurostar", ferry: "Ferry", taxi: "Taxi" };
const RISK = {
  comfortable: { c: "var(--sage)", bg: "var(--sage-soft)", label: "Comfortable" },
  tight: { c: "var(--amber)", bg: "var(--amber-soft)", label: "Tight" },
  risky: { c: "var(--rust)", bg: "var(--rust-soft)", label: "Risky" },
};

/* a crisp charcoal data-badge — the wayfinding number cell (platform/seat/gate) */
function Badge({ children, tone }) {
  const dark = tone !== "soft";
  return (
    <span className={`mono ${dark ? "engr-d" : "engr"}`} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 26, height: 24, padding: "0 8px", borderRadius: W.r.badge,
      fontSize: 12.5, fontWeight: 600, letterSpacing: "0.01em",
      background: dark ? W.char : "var(--gold-tint)",
      color: dark ? W.cream : "var(--gold-2)",
      boxShadow: dark ? "inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(28,22,14,0.28)" : "inset 0 0 0 1px rgba(176,158,124,0.3)",
    }}>{children}</span>
  );
}
window.Badge = Badge;

/* a labelled read-out field — small mono caption above a value (boarding-pass) */
function Field({ label, value, mono = true, align = "left", grow }) {
  return (
    <div style={{ textAlign: align, minWidth: 0, flex: grow ? 1 : "none" }}>
      <div className="eyb" style={{ fontSize: 8.5, color: "var(--ink-faint)", letterSpacing: "0.18em", marginBottom: 4, whiteSpace: "nowrap" }}>{label}</div>
      <div className={mono ? "mono engr" : ""} style={{ fontSize: 14, fontWeight: 600, letterSpacing: mono ? "0.01em" : "-0.01em", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}
window.Field = Field;

/* Derive the hero's first move + leave-by + arrival from a day's spine. */
function summarise(day) {
  let leaveBy = null, arrive = null, action = null, protectedCount = 0;
  for (const s of day.stops) {
    if (s.window && s.window.leaveBy && !leaveBy) leaveBy = s.window.leaveBy;
    if (s.protected || s.changeover) protectedCount++;
  }
  for (const s of day.stops) {
    if (action) break;
    if (s.move) { const l = s.move[0]; action = { icon: MODE_ICON[l.mode] || "walk", verb: MODE_WORD[l.mode] || "Go", to: l.to, mins: l.mins, label: l.label }; }
    else if (s.rail) action = { icon: "train", verb: "Board", to: s.rail.toName, mins: s.rail.mins, label: s.rail.line, dep: s.rail.from, from: s.rail.fromName };
    else if (s.flight) action = { icon: "plane", verb: "Fly", to: s.flight.toName, mins: s.flight.mins, label: s.flight.airline, dep: s.flight.from, from: s.flight.fromName };
  }
  for (let i = day.stops.length - 1; i >= 0; i--) {
    const s = day.stops[i];
    if (s.window && s.window.arrive) { arrive = s.window.arrive; break; }
  }
  return { leaveBy, arrive, action, protectedCount };
}

/* ════════════════════════════════ CHROME ══════════════════════════════════ */
function StatusBar() {
  return (
    <div className="statusbar">
      <div className="t mono">9:41</div>
      <div className="i">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="4.5" width="3" height="7.5" rx="1"/><rect x="10" y="2" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1" opacity="0.35"/></svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1 4.5C3.5 2 6 1 8.5 1S13.5 2 16 4.5" opacity="0.9"/><path d="M3.5 7C5 5.6 6.7 5 8.5 5s3.5.6 5 2"/><path d="M6 9.4c.8-.7 1.6-1 2.5-1s1.7.3 2.5 1"/><circle cx="8.5" cy="11" r="0.9" fill="currentColor" stroke="none"/></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x="0.6" y="0.6" width="21" height="10.8" rx="2.6" stroke="currentColor" strokeWidth="1" opacity="0.4"/><rect x="2" y="2" width="17" height="8" rx="1.4" fill="currentColor"/><rect x="23" y="3.5" width="1.6" height="5" rx="0.8" fill="currentColor" opacity="0.5"/></svg>
      </div>
    </div>
  );
}

/* editorial header — open type directly on the ground, with a floating mode
 * glyph (no container), an underline accent: the reference's “today.” grammar */
function dayGlyph(day) {
  for (const s of day.stops) { if (s.flight) return "plane"; if (s.rail) return "train"; }
  for (const s of day.stops) if (s.move) return MODE_ICON[s.move[0].mode] || "route";
  return "route";
}
function Header({ day }) {
  const parts = (day.eyebrow || "").split(" · ");
  const date = parts[0] || "";
  const context = parts.slice(1).join(" · ");
  const title = day.title || "";
  // a title may carry a descriptor after an em-dash ("London → Geneva — Lumen
  // review", "Theatre night — West End"). Split it off so the primary line stays
  // clean and the descriptor becomes its own subtitle — universal across day types.
  const dash = title.indexOf(" — ");
  const primary = dash >= 0 ? title.slice(0, dash) : title;
  const subtitle = dash >= 0 ? title.slice(dash + 3) : "";
  const route = primary.split(" → ");
  const isRoute = route.length === 2;
  return (
    <div style={{ padding: "2px 24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--gold-2)", boxShadow: "0 0 0 3px var(--gold-tint)" }} />
          <span className="eyb" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.34em", color: "var(--ink)" }}>KHONSERA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={iconChip}><Icon name="compass" size={16} /></button>
          <button style={iconChip}><Icon name="bell" size={16} /></button>
        </div>
      </div>
      {/* journey masthead — a tight, considered unit: quiet date eyebrow, then the
         route read as a journey (light weight, gold arrow) so it belongs to the
         page rather than floating as a bold afterthought */}
      <div className="eyb" style={{ fontSize: 9.5, letterSpacing: "0.2em", color: "var(--ink-faint)", marginBottom: 14 }}>
        {date}{context && <span style={{ color: "var(--ink-faint)" }}>{"   ·   " + context}</span>}
      </div>
      {isRoute ? (
        <h1 style={{ margin: 0, display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0 11px", fontSize: 25, letterSpacing: "-0.035em", lineHeight: 1.05 }}>
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{route[0]}</span>
          <span style={{ flex: "none", color: "var(--ink-dim)", fontWeight: 400 }}><Icon name="arrowRight" size={17} /></span>
          <span style={{ fontWeight: 400, color: "var(--ink-dim)" }}>{route[1]}</span>
        </h1>
      ) : (
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.08, maxWidth: "15ch", color: "var(--ink)" }}>{primary}</h1>
      )}
      {subtitle && (
        <div style={{ marginTop: 7, fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--ink-dim)" }}>{subtitle}</div>
      )}
    </div>
  );
}
const iconChip = { width: 36, height: 36, borderRadius: 999, display: "grid", placeItems: "center", border: "none", background: W.widget, color: "var(--ink-dim)", cursor: "pointer", boxShadow: W.liftSm, fontFamily: "var(--sans)" };

/* ════════════════════════════ THE NOW HERO ═════════════════════════════════
 * The grandest CREAM tile — same premium material as the cards, just the
 * largest and most emphatic. Charcoal is demoted to a single accent (the
 * primary key). Levels: tile (raised) · module (raised) · buffer (pressed). */
function NowHero({ day, onShowTicket }) {
  const s = summarise(day);
  const live = day.live && day.live.calm;
  if (!s.leaveBy && !s.action) {
    return (
      <div className="pg" style={heroWrap}>
        <div className="eyb" style={{ fontSize: 9.5, color: "var(--ink-faint)", letterSpacing: "0.22em" }}>Reference</div>
        <div style={{ marginTop: 12, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)", lineHeight: 1.14 }}>{day.stops[0] && day.stops[0].name}</div>
        <div style={{ marginTop: 7, fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.45 }}>{day.stops[0] && day.stops[0].area}</div>
      </div>
    );
  }
  const leave = s.leaveBy || (s.action && s.action.dep) || "";
  const t = leave.split(":");
  const segs = chainSegs(day);
  const firstArrive = s.action ? addMins(leave, s.action.mins) : null;
  const land = (() => { const a = heroArc(day); return a.find(n => n.dest) || null; })();
  const catchSeg = segs && segs[0];
  const downstream = segs ? segs.slice(1) : [];
  return (
    <div style={{ margin: "4px 16px 24px" }}>
      {/* Composition borrowed from the reference "today." date widget: ONE soft
         cream card holding a giant thin numeral (the leave time) beside a single
         nested charcoal block (what it catches) — the lone dark accent. The move
         + downstream read quietly beneath. */}
      <div className="pg" style={heroHeroWrap}>
        {/* top split seated in a recessed well — the dark catch block + move chip
           raise out of it for a clear level story (sink vs. raise) */}
        <div style={heroWell}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 16 }}>
          <div style={heroLeaveWell}>
            <span className="eyb" style={{ fontSize: 9.5, letterSpacing: "0.26em", color: "var(--ink-faint)", fontWeight: 600, marginBottom: 10 }}>Leave at</span>
            <div className="mono" style={{ fontSize: 54, fontWeight: 300, letterSpacing: "-0.05em", color: "var(--ink)", lineHeight: 0.86, display: "flex", alignItems: "baseline", textShadow: "0 1px 0 rgba(255,255,255,0.95), 0 -1px 1px rgba(36,30,22,0.18)" }}>
              <span>{t[0]}</span><span style={{ color: "rgba(32,36,43,0.42)", padding: "0 1px", fontWeight: 400 }}>:</span><span>{t[1]}</span>
            </div>
          </div>
          {catchSeg ? (
            <div className="pg-d" style={heroCatchDark}>
              <div className="eyb" style={{ fontSize: 8, letterSpacing: "0.2em", color: "rgba(244,240,231,0.55)", fontWeight: 600 }}>To catch</div>
              <div className="mono engr-deep" style={{ fontSize: 27, fontWeight: 400, color: "#f4f0e7", letterSpacing: "-0.02em", lineHeight: 1, marginTop: 7 }}>{catchSeg.clock}</div>
              {catchSeg.to && <div style={{ fontSize: 11, color: "rgba(244,240,231,0.62)", marginTop: 4, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>to {shortName(catchSeg.to)}</div>}
              {catchSeg.icon && (
                <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", alignItems: "center", gap: 6, color: "rgba(244,240,231,0.5)", borderTop: "1px solid rgba(244,240,231,0.1)" }}>
                  <Icon name={catchSeg.icon} size={13} />
                  {catchSeg.mode && <span className="eyb" style={{ fontSize: 8.5, letterSpacing: "0.16em", color: "rgba(244,240,231,0.5)" }}>{catchSeg.mode}</span>}
                </div>
              )}
            </div>
          ) : land ? (
            <div className="pg-d" style={heroCatchDark}>
              <div className="eyb" style={{ fontSize: 8, letterSpacing: "0.2em", color: "rgba(244,240,231,0.55)", fontWeight: 600 }}>Lands</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#f4f0e7", marginTop: 7, lineHeight: 1.15 }}>{land.label}</div>
              <div className="mono engr-d" style={{ fontSize: 12, color: "rgba(244,240,231,0.6)", marginTop: "auto", paddingTop: 10 }}>{land.t}</div>
            </div>
          ) : null}
        </div>
        {s.action && (
          <div style={{ marginTop: 13, display: "flex", alignItems: "center", gap: 10, padding: "9px 6px 2px 7px", borderTop: "1px solid var(--line-soft)" }}>
            <CreamChip icon={s.action.icon} size={30} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1 }}>{s.action.verb} to {shortName(s.action.to)}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 2 }}>{durLabel(s.action.mins)}{firstArrive ? ` · arrive ${firstArrive}` : ""}</div>
            </div>
          </div>
        )}
        </div>
        {/* one primary action + a quiet secondary, raised pills */}
        <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
          <button className="pg-d" style={heroNavWide}><Icon name="navigation" size={13} />Navigate</button>
          <button style={heroAlarmPill}><Icon name="bell" size={15} /></button>
        </div>
        {/* downstream — quiet, seated in its own shallow well */}
        {downstream.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px 9px", marginTop: 13, paddingTop: 13, borderTop: "1px solid var(--line-soft)" }}>
            <span className="eyb" style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--ink-faint)", fontWeight: 600 }}>Then</span>
            {downstream.map((sg, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: "var(--ink-faint)", fontSize: 10 }}>•</span>}
                <span className="mono" style={{ fontSize: 11.5, fontWeight: sg.risk ? 600 : 500, color: sg.risk ? (RISK[sg.risk] || {}).c : "var(--ink-dim)", letterSpacing: "0.01em" }}>{sg.t}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* add minutes to an HH:MM clock string */
function addMins(hhmm, mins) {
  if (!hhmm) return null;
  const p = hhmm.split(":"); const h = +p[0], m = +p[1];
  if (isNaN(h) || isNaN(m)) return null;
  let tot = (((h * 60 + m + (mins || 0)) % 1440) + 1440) % 1440;
  return String(Math.floor(tot / 60)).padStart(2, "0") + ":" + String(tot % 60).padStart(2, "0");
}

/* The downstream arc: the day's hard anchors after leaving — first one or two
 * transit departures, then the destination. Proves the chain lands rather than
 * just stating a leave time. Each node carries t (clock), icon, label, mode and
 * (on a node reached through a protected hop) protectedBy = buffer minutes. */
function heroArc(day) {
  const nodes = [];
  let pendingCo = null;
  for (const st of day.stops) {
    if (st.changeover) { pendingCo = { mins: st.changeover.available, risk: st.changeover.risk }; continue; }
    let n = null;
    if (st.rail && st.rail.from) n = { t: st.rail.from, icon: "train", mode: "train", label: st.rail.toCode || st.rail.toName || "", sub: st.rail.toName || st.rail.line };
    else if (st.flight && st.flight.from) n = { t: st.flight.from, icon: "plane", mode: "flight", label: st.flight.toCode || "", sub: st.flight.toName || st.flight.airline };
    if (n) {
      if (pendingCo && nodes.length) { n.changeMins = pendingCo.mins; n.changeRisk = pendingCo.risk; }
      pendingCo = null;
      nodes.push(n);
      if (nodes.length >= 2) break;
    }
  }
  // destination anchor — a work window start, else the last placed arrival
  let dest = null;
  for (let i = day.stops.length - 1; i >= 0; i--) {
    const st = day.stops[i];
    if (st.window && st.window.from) { dest = { t: st.window.from, icon: st.icon || "building", mode: "", label: shortName(st.name), sub: st.area, dest: true }; break; }
  }
  if (!dest) for (let i = day.stops.length - 1; i >= 0; i--) {
    const st = day.stops[i];
    if (st.window && st.window.arrive && !st.container) { dest = { t: st.window.arrive, icon: st.icon || "pin", mode: "", label: shortName(st.name), sub: st.area, dest: true }; break; }
  }
  if (dest && !(nodes.length && nodes[nodes.length - 1].t === dest.t)) {
    if (pendingCo && nodes.length) { dest.changeMins = pendingCo.mins; dest.changeRisk = pendingCo.risk; }
    nodes.push(dest);
  }
  return nodes;
}
/* The day's spine as plain words: first move, the change (with its real buffer
 * and risk colour), and where you land. Quiet typography, not a graphic. */
function chainSegs(day) {
  const arc = heroArc(day);
  if (!arc || arc.length < 2) return null;
  const segs = [];
  const first = arc.find(n => !n.dest);
  if (first) segs.push({ t: `${first.t} ${first.mode || ""}`.trim(), to: first.sub, clock: first.t, icon: first.icon, mode: first.mode });
  const chIdx = arc.findIndex(n => n.changeMins != null);
  if (chIdx > 0) {
    const loc = arc[chIdx - 1].sub;
    segs.push({ t: `${arc[chIdx].changeMins} min to change${loc ? ` at ${loc}` : ""}`, risk: arc[chIdx].changeRisk });
  }
  const dest = arc.find(n => n.dest);
  if (dest) segs.push({ t: `${dest.label} by ${dest.t}`, dest: true });
  return segs.length >= 2 ? segs : null;
}
function shortName(name) {
  if (!name) return "";
  return name.replace(/\s*Station$/i, "").replace(/^The\s+/i, "").split(",")[0];
}
const heroNavBtn = { display: "inline-flex", alignItems: "center", gap: 5, height: 32, padding: "0 13px", borderRadius: 11, border: "none", background: "linear-gradient(168deg, #2b2f38, #1b1e24)", color: "#f3efe6", fontSize: 12, fontWeight: 600, letterSpacing: "0.01em", cursor: "pointer", flex: "none", fontFamily: "var(--sans)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(28,22,14,0.3), 0 4px 10px -3px rgba(28,22,14,0.4)" };
const heroDark = {
  position: "relative", padding: "18px 18px", borderRadius: W.r.hero,
  background: "linear-gradient(165deg, #272a33 0%, #1a1d23 58%, #131419 100%)",
  border: "1px solid rgba(244,240,231,0.1)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 46px -22px rgba(8,8,12,0.72), 0 3px 10px -4px rgba(8,8,12,0.5)",
};
const heroNavGold = { display: "inline-flex", alignItems: "center", gap: 5, height: 34, padding: "0 14px", borderRadius: 11, border: "none", background: "linear-gradient(168deg, #2b2f38, #1f2228)", color: "#1c1e24", fontSize: 12, fontWeight: 700, letterSpacing: "0.01em", cursor: "pointer", flex: "none", fontFamily: "var(--sans)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 9px -2px rgba(205,163,73,0.55)" };
const heroGhostDark = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 44, marginTop: 15, borderRadius: 13, border: "1px solid rgba(224,189,116,0.22)", background: "rgba(224,189,116,0.06)", color: "#e0bd74", fontSize: 13, fontWeight: 600, letterSpacing: "0.01em", cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap" };
const heroWrap = {
  position: "relative", padding: "16px 18px", borderRadius: W.r.hero,
  background: "var(--widget)",
  boxShadow: "var(--lift)",
};
const heroHeroWrap = {
  position: "relative", padding: "16px 16px 16px", borderRadius: W.r.hero,
  background: "var(--widget)",
  boxShadow: "var(--lift)",
};
// the focal "now" panel — recessed into the card so the dark catch block raises out of it
const heroWell = {
  padding: 0, borderRadius: 20,
  background: "transparent",
};
const heroLeaveWell = {
  flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center",
  padding: "14px 4px",
};
// the lone charcoal accent — the reference's nested calendar block
const heroCatchDark = {
  display: "flex", flexDirection: "column", width: 112, flex: "none",
  padding: "13px 14px", borderRadius: 14,
  // dark cotton — flat charcoal stock; .pg-d adds the screen-blend tooth,
  // the bright top lip and the single-sheet cast shadow
  background: "var(--char)",
};
const heroNavWide = { flex: 1, height: 46, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 13, border: "none", background: "var(--char)", color: "#f3efe6", fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", cursor: "pointer", fontFamily: "var(--sans)" };
const heroAlarmPill = { width: 46, height: 46, flex: "none", display: "grid", placeItems: "center", borderRadius: 15, border: "none", color: "var(--gold-2)", cursor: "pointer", fontFamily: "var(--sans)", background: "var(--widget)", boxShadow: "var(--lift-sm)" };
const heroModule = {
  background: "var(--widget)",
  boxShadow: "var(--lift-sm)",
};
const creamChipShadow = "var(--lift-sm)";
const heroBtn = { height: 50, borderRadius: 16, border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", cursor: "pointer", fontFamily: "var(--sans)" };
function CreamChip({ icon, size = 44, accent = "var(--ink-dim)", bg = "var(--widget-2)" }) {
  return <span style={{ display: "inline-grid", placeItems: "center", width: size, height: size, borderRadius: Math.round(size * 0.32), background: bg, color: accent, flex: "none", boxShadow: creamChipShadow }}><Icon name={icon} size={Math.round(size * 0.5)} /></span>;
}

window.PlannerV6Chrome = { StatusBar, Header, NowHero, summarise, MODE_ICON, MODE_WORD, RISK, Badge, Field };
