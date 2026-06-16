"use client";

// N1 — the premium guidance surface. Presentational: it renders Design's `.cc-nav*`
// skin (khonsera-edition-iii-nav.css) bound to the REAL nav contracts (EventETA,
// NavDecision). The runtime (watchPosition pace + Darwin/TfL + the ways-out fetch)
// feeds these props through the N0/N2 engines; this draws them. Two chromes
// (light / dark), six states, the hero ETA chip, the maneuver banner, the decision
// card. Governing rule: operational trust + the differentiator on screen, calm.

import type { ReactNode } from "react";
import type { ManeuverKind } from "@/lib/nav/types";
import type { EventETA } from "@/lib/nav/event-eta";
import type { NavDecision } from "@/lib/nav/decision-loop";
import { ManeuverGlyph } from "@/components/nav/maneuver-glyph";
import { formatClock } from "@/components/concierge/types";
import { spareLabel, etaForLabel, defaultEtaSub, glyphForMode, type NavGlyphKey } from "@/lib/nav/guidance-format";

// ── icon set (mirrors Design's proof; stroke = currentColor) ────────────────
function Svg({ d, sw = 1.7, size }: { d: string; sw?: number; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} aria-hidden>
      <path d={d} />
    </svg>
  );
}
const ICON = {
  recenter: "M12 2v3M12 19v3M2 12h3M19 12h3 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  overview: "M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z M9 4v13 M15 7v13",
  end: "M18 6 6 18M6 6l12 12",
  check: "M20 6 9 17l-5-5",
  checkCircle: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M8.5 12.5 11 15l4.5-5",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 11v5 M12 8h.01",
  alert: "M12 3 2 20h20L12 3Z M12 10v4 M12 17h.01",
  offline: "M3 3l18 18M8.5 8.5A6 6 0 0 0 5 11M12 5a11 11 0 0 1 7 3M9 13a4 4 0 0 1 5 0M12 17h.01",
};
const MODE_GLYPH: Record<NavGlyphKey, string> = {
  tube: "M4 4h16v14H4z M4 11h16 M8 21l1.5-3 M16 21l-1.5-3",
  taxi: "M5 17h14M6 17v-4l2-5h8l2 5v4M9 8V5h6v3 M8 17a0 0 0 1 0 0M16 17a0 0 0 1 0 0",
  bus: "M5 4h14v13H5z M5 11h14 M8 17v2 M16 17v2",
  walk: "M12 4a1.6 1.6 0 1 0 0-.01 M11 8l-2 5 2 1 1 6 M11 8l3 2 3-1",
  rail: "M7 4h10v11H7z M7 10h10 M9 19l-2 2M15 19l2 2 M10 15h4",
  drive: "M5 16l1-5h12l1 5 M3 16h18v3H3z M7 16a0 0 0 1 0 0",
};

// ── A · EventETAChip ────────────────────────────────────────────────────────
export function EtaChip({ eta, sub, secondary }: { eta: EventETA; sub?: string; secondary?: boolean }) {
  return (
    <div className="cc-nav-eta-chip" data-state={eta.state} {...(secondary ? { "data-secondary": "" } : {})}>
      <span className="cc-nav-eta-dot" />
      <div className="cc-nav-eta-body">
        <div className="cc-nav-eta-line">
          <span className="place">{eta.place.toUpperCase()}</span>
          <span className="em">—</span>
          <span className="at">{formatClock(eta.projectedArrivalIso)}</span>
        </div>
        {!secondary ? <div className="cc-nav-eta-sub">{sub ?? defaultEtaSub(eta)}</div> : null}
      </div>
      <span className="cc-nav-eta-spare">{spareLabel(eta)}</span>
    </div>
  );
}

// ── B · ManeuverBanner ──────────────────────────────────────────────────────
export type ManeuverVM = {
  kind: ManeuverKind;
  distanceValue: string; // "220"
  distanceUnit: string; // "m" · "km"
  step: string; // "Right onto Brixton Road"
  nextKind?: ManeuverKind; // the turn after — a quiet pre-cue
};
export function ManeuverBanner({ m }: { m: ManeuverVM }) {
  return (
    <div className="cc-nav-maneuver">
      <div className="cc-nav-maneuver-glyph"><ManeuverGlyph kind={m.kind} size={46} color="currentColor" /></div>
      <div className="cc-nav-maneuver-main">
        <div className="cc-nav-maneuver-dist">{m.distanceValue}<u>{m.distanceUnit}</u></div>
        <div className="cc-nav-maneuver-step">{m.step}</div>
      </div>
      {m.nextKind ? (
        <div className="cc-nav-maneuver-next">
          <ManeuverGlyph kind={m.nextKind} size={22} color="currentColor" />
          <span className="lbl">Then</span>
        </div>
      ) : null}
    </div>
  );
}

// ── C · DecisionCard ────────────────────────────────────────────────────────
export function DecisionCard({ decision, onAccept, onDismiss }: { decision: NavDecision; onAccept?: () => void; onDismiss?: () => void }) {
  const act = decision.severity === "act";
  const rec = decision.recommendation;
  const threatened = !!rec?.option.returnNote;
  return (
    <div className="cc-nav-decision" data-severity={decision.severity}>
      <div className="cc-nav-decision-head">
        <div className="cc-nav-decision-eyebrow">
          <Svg d={act ? ICON.alert : ICON.info} size={13} />
          {act ? "A decision" : "Heads up"}
        </div>
        <h3 className="cc-nav-decision-headline">{decision.headline}</h3>
        <p className="cc-nav-decision-consequence">{decision.consequence}</p>
      </div>
      {act && rec ? (
        <div className="cc-nav-decision-option">
          <div className="cc-nav-decision-option-top">
            <span className="cc-nav-decision-mode">
              <Svg d={MODE_GLYPH[glyphForMode(rec.option.mode)]} size={12} />
              {rec.option.mode.charAt(0).toUpperCase() + rec.option.mode.slice(1)}
            </span>
            <span className="cc-nav-decision-option-label">{rec.option.label}</span>
          </div>
          <div className="cc-nav-decision-times">
            {formatClock(rec.option.departIso)} &rarr; {formatClock(rec.option.arriveIso)}
            {rec.option.makesIt ? (
              <span className="makes"><Svg d={ICON.check} size={13} sw={2} /> makes {decision.pinchName}</span>
            ) : null}
          </div>
          <p className="cc-nav-decision-tradeoff" {...(threatened ? { "data-return-threat": "" } : {})}>{rec.tradeoff}</p>
        </div>
      ) : null}
      <div className="cc-nav-decision-actions">
        {act ? (
          <>
            <button type="button" className="cc-nav-decision-accept" onClick={onAccept}>Accept</button>
            <button type="button" className="cc-nav-decision-dismiss" onClick={onDismiss}>Let me think</button>
          </>
        ) : (
          <button type="button" className="cc-nav-decision-dismiss" onClick={onDismiss}>Got it</button>
        )}
      </div>
    </div>
  );
}

// ── the surface shell ───────────────────────────────────────────────────────
export type GuidanceState = "acquiring" | "guiding" | "offsignal" | "arrived";

export function GuidanceSurface({
  state,
  chrome = "light",
  map,
  maneuver,
  etas,
  etaSub,
  consequence,
  decision,
  status,
  arrived,
  onRecenter,
  onOverview,
  onEnd,
  onAcceptDecision,
  onDismissDecision,
}: {
  state: GuidanceState;
  chrome?: "light" | "dark";
  map: ReactNode; // the MapLibre plate
  maneuver?: ManeuverVM;
  etas?: EventETA[]; // lead first, rest render as secondary chips
  etaSub?: string;
  consequence?: string; // the thin at-risk line above the chip
  decision?: NavDecision | null;
  status?: { tone?: "offline"; pulse?: boolean; text: string; mono?: string };
  arrived?: { headline: string; sub?: string; onBack?: () => void };
  onRecenter?: () => void;
  onOverview?: () => void;
  onEnd?: () => void;
  onAcceptDecision?: () => void;
  onDismissDecision?: () => void;
}) {
  const [lead, ...secondary] = etas ?? [];
  const showChrome = state === "guiding" || state === "offsignal";
  return (
    <div className="cc-nav" data-state={state} {...(chrome === "dark" ? { "data-chrome": "dark" } : {})}>
      <div className="cc-nav-map">{map}</div>

      {state === "acquiring" ? (
        <div className="cc-nav-acquiring">
          <div>
            <div className="cc-nav-acquiring-ring" />
            <div className="cc-nav-acquiring-text">Finding you…</div>
          </div>
        </div>
      ) : null}

      {status ? (
        <div className="cc-nav-status" {...(status.pulse ? { "data-pulse": "" } : {})} {...(status.tone ? { "data-tone": status.tone } : {})}>
          <span className="dot" />
          {status.text}
          {status.mono ? <span className="mono">{status.mono}</span> : null}
        </div>
      ) : null}

      {showChrome && maneuver ? <ManeuverBanner m={maneuver} /> : null}

      {showChrome && (onRecenter || onOverview || onEnd) ? (
        <div className="cc-nav-controls">
          {onRecenter ? <button type="button" className="cc-nav-ctl" onClick={onRecenter}><Svg d={ICON.recenter} size={20} /></button> : null}
          {onOverview ? <button type="button" className="cc-nav-ctl" onClick={onOverview}><Svg d={ICON.overview} size={20} /></button> : null}
          {onEnd ? <button type="button" className="cc-nav-ctl" data-end onClick={onEnd}><Svg d={ICON.end} size={20} sw={2} /></button> : null}
        </div>
      ) : null}

      {showChrome && lead ? (
        <div className="cc-nav-eta">
          {consequence ? (
            <div className="cc-nav-consequence"><Svg d={ICON.alert} size={15} /> {consequence}</div>
          ) : null}
          <div className="cc-nav-eta-for">{etaForLabel(lead.name)}</div>
          <EtaChip eta={lead} sub={etaSub} />
          {secondary.map((e) => <EtaChip key={e.commitmentId} eta={e} secondary />)}
        </div>
      ) : null}

      {decision ? (
        <DecisionCard decision={decision} onAccept={onAcceptDecision} onDismiss={onDismissDecision} />
      ) : null}

      {state === "arrived" && arrived ? (
        <div className="cc-nav-arrived">
          <div className="cc-nav-arrived-inner">
            <div className="cc-nav-arrived-mark"><Svg d={ICON.checkCircle} size={54} sw={1.8} /></div>
            <h3 className="cc-nav-arrived-headline">{arrived.headline}</h3>
            {arrived.sub ? <p className="cc-nav-arrived-sub">{arrived.sub}</p> : null}
            <button type="button" className="cc-nav-arrived-back" onClick={arrived.onBack}>Back to the day</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
