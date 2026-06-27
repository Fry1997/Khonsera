/* ════════════════════════════════════════════════════════════════════════
 * Khonsera · Gin Rummy — the felt table (single-player vs a heuristic bot).
 *
 * Ported (look + UX) from the design handoff (gin-rummy.jsx / GinRummy.html),
 * re-wired onto OUR engine (src/lib/games/gin-rummy) and OUR bot (bot.ts). The
 * prototype's window.GinEngine + its AI are ignored — every action goes through
 * `legalMoves` / `applyMove`, and the opponent is driven by `chooseMove`.
 *
 * Pure client state — no backend. We own one `GinState`; the human plays
 * player 0, the bot plays player 1. After the human's turn we drive the bot on
 * a short timer so it reads as a turn. The deal seed is chosen in an effect/
 * handler (a mounting counter), never in render, so SSR stays deterministic and
 * the ssr:false dynamic import has nothing to mismatch.
 *
 * Card asset: <PlayingCard rank suit faceDown? /> — our Card maps straight on.
 * ════════════════════════════════════════════════════════════════════════ */
"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PlayingCard, rankLabel } from "@/components/solitaire/playing-card";
import {
  type Card,
  type GinState,
  type Move,
  type Player,
  type RoundResult,
  cardId,
  cardValue,
  cardsEqual,
  createGame,
  deadwoodValueOf,
  meldsAndDeadwood,
  startNextRound,
  applyMove,
} from "@/lib/games/gin-rummy";
import { chooseMove } from "@/lib/games/gin-rummy/bot";
import "./gin-rummy.css";

const YOU: Player = 0;
const OPP: Player = 1;
const OPP_NAME = "Khonsera";
const TARGET = 100;
const LS = "khonsera_gin_v1";

const SUIT_CH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const isRed = (s: string) => s === "H" || s === "D";

/* ── viewport sizing hook ────────────────────────────────────────────────── */
function useViewport() {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return vp;
}

/* ── hand fan layout: even overlap, centred, last card always fully shown ─── */
function layoutFan(n: number, cw: number, avail: number) {
  let step = cw;
  if (n * cw > avail) step = (avail - cw) / (n - 1);
  step = Math.min(cw, Math.max(cw * 0.4, step));
  const span = step * (n - 1) + cw;
  const x0 = Math.max(0, (avail - span) / 2);
  return { step, x0, span };
}

/* ── a fresh seed (chosen at mount / new-game, never in render) ──────────── */
function freshSeed(counter: number): string {
  return `khn-${counter}-${Math.floor(Math.random() * 1e9)}`;
}

type RevealLine = { src?: "stock" | "discard" | "pass"; discarded?: Card; knocked?: boolean };

export function GinRummyGame() {
  const vp = useViewport();
  const landscape = vp.w > vp.h && vp.w >= 620;

  // The seed is chosen in an effect (below) so the first client render is a
  // stable placeholder — no Math.random in render.
  const seedCounter = useRef(0);
  const [state, setState] = useState<GinState | null>(null);
  const [sel, setSel] = useState<Card | null>(null);
  const [reveal, setReveal] = useState<RevealLine | null>(null);
  const [overlay, setOverlay] = useState<"round" | "game" | null>(null);
  const [htp, setHtp] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const dragInfo = useRef<{ id: string; startX: number; moved: boolean } | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const orderCommitRef = useRef<string[]>([]);
  const fanRef = useRef<{ step: number; x0: number; span: number } | null>(null);
  const oppActRef = useRef<RevealLine | null>(null);
  const dealtKey = useRef(0);

  /* ── boot: deal the first game on the client only ── */
  useEffect(() => {
    seedCounter.current += 1;
    setState(createGame({ seed: freshSeed(seedCounter.current), target: TARGET }));
    // No persistence restore by default — a fresh table each visit is the
    // expected feel for the felt games; LS is namespaced and reserved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── overlay sync ── */
  useEffect(() => {
    if (!state) return;
    if (state.phase === "gameOver") setOverlay("game");
    else if (state.phase === "roundOver") setOverlay("round");
  }, [state?.phase, state?.round, state]);

  /* ── the bot driver: when it's the opponent's turn, play one move on a
   *    short delay so it reads as a turn. ── */
  useEffect(() => {
    if (!state) return;
    if (state.phase === "roundOver" || state.phase === "gameOver") return;
    if (state.turn !== OPP) return;
    const delay = state.phase === "discard" ? 780 : 620;
    const t = setTimeout(() => {
      const mv = chooseMove(state, OPP);
      if (!mv) return;
      if (mv.type === "drawStock") oppActRef.current = { src: "stock" };
      else if (mv.type === "drawDiscard")
        oppActRef.current = { ...(oppActRef.current ?? {}), src: "discard" };
      else if (mv.type === "passUpcard") oppActRef.current = { src: "pass" };
      const next = applyMove(state, OPP, mv);
      if ("error" in next) return;
      if (mv.type === "discard" || mv.type === "knock") {
        const a = oppActRef.current ?? {};
        setReveal({ ...a, discarded: mv.card, knocked: mv.type === "knock" });
        oppActRef.current = null;
      } else if (mv.type === "passUpcard") {
        setReveal({ src: "pass" });
      }
      setState(next);
    }, delay);
    return () => clearTimeout(t);
  }, [state]);

  /* ── apply one of the human's moves ── */
  const apply = useCallback(
    (mv: Move) => {
      if (!state) return;
      const next = applyMove(state, YOU, mv);
      if ("error" in next) return;
      setSel(null);
      setState(next);
    },
    [state],
  );

  /* keep the player's manual arrangement in sync with the live hand */
  const yourHand = state ? state.hands[YOU] : [];
  useEffect(() => {
    const ids = yourHand.map(cardId);
    setOrder((prev) => {
      const idset = new Set(ids);
      const kept = prev.filter((id) => idset.has(id));
      const keptSet = new Set(kept);
      const added = ids.filter((id) => !keptSet.has(id));
      if (kept.length === prev.length && added.length === 0) return prev;
      return kept.concat(added);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourHand.map(cardId).join(",")]);

  /* ── persist a light snapshot (namespaced) so a refresh resumes ── */
  useEffect(() => {
    if (!state) return;
    try {
      window.localStorage.setItem(LS, JSON.stringify({ state, order }));
    } catch {
      /* storage may be unavailable — ignore */
    }
  }, [state, order]);

  if (!state) {
    // First client paint before the deal effect runs: the route box already
    // shows the felt underlay, so render nothing here.
    return <div className="gin-felt" aria-hidden="true" />;
  }

  const yourTurn =
    state.turn === YOU && state.phase !== "roundOver" && state.phase !== "gameOver";

  /* sizing — bias toward legibility */
  let cw: number, ccw: number, ocw: number;
  if (landscape) {
    ccw = Math.max(56, Math.min(94, (vp.h - 148) / 3.4));
    cw = ccw * 0.82;
    ocw = ccw * 0.6;
  } else {
    cw = Math.max(62, Math.min(82, (vp.w - 24) / 5.4, vp.h * 0.165));
    ccw = Math.max(74, Math.min(90, vp.w / 4.5));
    ocw = ccw * 0.58;
  }
  const avail = (vp.w || 360) - 28;

  const opening =
    state.phase === "upcardNonDealer" || state.phase === "upcardDealer";

  /* ── human action handlers ── */
  function tapStock() {
    if (yourTurn && state!.phase === "draw") apply({ type: "drawStock" });
  }
  function tapDiscardPile() {
    if (!yourTurn) return;
    if (state!.phase === "draw" || opening) apply({ type: "drawDiscard" });
  }
  function passUpcard() {
    if (yourTurn && opening) apply({ type: "passUpcard" });
  }
  function tapHandCard(c: Card) {
    if (!yourTurn || state!.phase !== "discard") return;
    setSel((s) => (s && cardsEqual(s, c) ? null : c));
  }
  function doDiscard() {
    if (sel) apply({ type: "discard", card: sel });
  }
  function doKnock() {
    if (sel) apply({ type: "knock", card: sel });
  }
  function nextRound() {
    const n = startNextRound(state!);
    if (!("error" in n)) {
      setReveal(null);
      setOverlay(null);
      setSel(null);
      dealtKey.current += 1;
      setState(n);
    }
  }
  function newGame() {
    seedCounter.current += 1;
    setReveal(null);
    setOverlay(null);
    setSel(null);
    dealtKey.current += 1;
    setState(createGame({ seed: freshSeed(seedCounter.current), target: TARGET }));
  }

  /* ── contextual deadwood read-out ── */
  const dwInfo = (() => {
    if (state.phase === "discard" && state.turn === YOU) {
      if (sel) {
        const after = yourHand.filter((c) => !cardsEqual(c, sel));
        const v = deadwoodValueOf(after);
        return { value: v, canKnock: v <= 10, gin: v === 0, projected: true };
      }
      let best = 99;
      for (const c of yourHand) {
        const v = deadwoodValueOf(yourHand.filter((x) => !cardsEqual(x, c)));
        if (v < best) best = v;
      }
      return { value: best, canKnock: best <= 10, gin: best === 0, projected: true };
    }
    const v = deadwoodValueOf(yourHand);
    return { value: v, canKnock: false, gin: false, projected: false };
  })();

  /* ── which of your cards are melded (gold underline) ── */
  const meldedIds = meldedCardIds(yourHand);

  /* ── turn banner ── */
  const banner = (() => {
    if (state.phase === "gameOver" || state.phase === "roundOver") return null;
    if (state.turn === YOU) {
      if (opening) return { you: true, ph: "OPENING", msg: "Take the up-card, or pass", sub: null as string | null };
      if (state.phase === "draw")
        return { you: true, ph: "YOUR MOVE", msg: "Draw a card", sub: "Stock or the up-card" };
      if (state.phase === "discard")
        return {
          you: true,
          ph: "YOUR MOVE",
          msg: sel ? "Discard, or knock if you can" : "Choose a card to discard",
          sub: null,
        };
    }
    return { you: false, ph: "THEIR MOVE", msg: `${OPP_NAME} is playing`, sub: null };
  })();

  const stockEmpty = state.stock.length === 0;
  const top = state.discard[state.discard.length - 1];
  const litDiscard = yourTurn && (state.phase === "draw" || opening);
  const litStock = yourTurn && state.phase === "draw" && !stockEmpty;

  /* ── hand render order + drag preview ── */
  const byId = new Map<string, Card>();
  yourHand.forEach((c) => byId.set(cardId(c), c));
  const baseOrder = order.filter((id) => byId.has(id));
  const nH = baseOrder.length;
  const fan = layoutFan(Math.max(1, nH), cw, avail);
  fanRef.current = fan;

  let renderOrder = baseOrder;
  let draggedLeft: number | null = null;
  if (dragId != null && byId.has(dragId)) {
    const overIdx = Math.max(0, Math.min(nH - 1, Math.round((dragX - fan.x0 - cw / 2) / fan.step)));
    renderOrder = baseOrder.filter((id) => id !== dragId);
    renderOrder.splice(overIdx, 0, dragId);
    draggedLeft = Math.max(0, Math.min(fan.span - cw, dragX - cw / 2));
  }
  orderCommitRef.current = renderOrder;

  function onHandPointerDown(e: ReactPointerEvent<HTMLDivElement>, card: Card) {
    if (!handRef.current) return;
    dragInfo.current = { id: cardId(card), startX: e.clientX, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* not all environments support capture */
    }
    setDragX(e.clientX - handRef.current.getBoundingClientRect().left);
    setDragId(cardId(card));
  }
  function onHandPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragInfo.current || !handRef.current) return;
    if (Math.abs(e.clientX - dragInfo.current.startX) > 6) dragInfo.current.moved = true;
    setDragX(e.clientX - handRef.current.getBoundingClientRect().left);
  }
  function onHandPointerUp(card: Card) {
    const info = dragInfo.current;
    dragInfo.current = null;
    const moved = info && info.moved;
    setDragId(null);
    if (!info) return;
    if (!moved) {
      tapHandCard(card);
      return;
    }
    setOrder(orderCommitRef.current.slice());
  }

  const youLead = state.scores[YOU] > state.scores[OPP];
  const oppLead = state.scores[OPP] > state.scores[YOU];

  /* opponent fan */
  const oppCount = state.hands[OPP].length;
  const oppStep = Math.min(
    ocw * 0.5,
    (Math.min(avail, 280) - ocw) / Math.max(1, oppCount - 1),
  );
  const oppSpan = oppStep * (oppCount - 1) + ocw;

  const revLines = revealLine(reveal);

  return (
    <div className={"gin-felt" + (landscape ? " land" : "")}>
      {/* top bar */}
      <div className="gin-tbar">
        <Link
          href={"/pastimes" as Route}
          className="gin-ico-t"
          aria-label="Back to Pastimes"
          title="Back to Pastimes"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="gin-scoreline">
          <div className={"sc" + (youLead ? " lead" : "")}>
            <div className="k">YOU</div>
            <div className="v">{state.scores[YOU]}</div>
          </div>
          <div className="sc tgt">
            <div className="k">TO</div>
            <div className="v">{state.target}</div>
          </div>
          <div className={"sc" + (oppLead ? " lead" : "")}>
            <div className="k">{OPP_NAME.toUpperCase().slice(0, 5)}</div>
            <div className="v">{state.scores[OPP]}</div>
          </div>
        </div>
        <button className="gin-ico-t" onClick={() => setHtp(true)} title="How to play" aria-label="How to play">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx={12} cy={12} r={9} />
            <path d="M9.3 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 2.4" />
            <circle cx={12} cy={17} r={0.7} fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      <div className="gin-table">
        {/* opponent zone */}
        <div className="gin-opp" style={{ "--ocw": ocw + "px" } as CSSProperties}>
          <div className="gin-opp-id">
            <span className="gin-pres on" />
            <span className="nm">{OPP_NAME}</span>
            <span className="cards">{oppCount} cards</span>
          </div>
          <div className="gin-opp-fan" style={{ width: oppSpan + "px" } as CSSProperties}>
            {Array.from({ length: oppCount }).map((_, i) => (
              <PlayingCard
                key={i}
                faceDown
                style={{ "--cw": ocw + "px", left: i * oppStep + "px" } as CSSProperties}
              />
            ))}
          </div>
          <div className="gin-opp-reveal">
            {!revLines ? (
              <span className="ln" style={{ opacity: 0.4 }}>
                {"—"}
              </span>
            ) : (
              <span className="ln">
                {revLines.map((p, i) => (
                  <span key={i}>
                    {i ? <span style={{ color: "#5a626c", margin: "0 6px" }}>{"·"}</span> : null}
                    {p.t}
                    {p.card ? <CardTok c={p.card} /> : null}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>

        {/* centre: piles + turn */}
        <div className="gin-centre">
          <div className="gin-piles" style={{ "--ccw": ccw + "px" } as CSSProperties}>
            {/* stock */}
            <div className="gin-pile">
              <div className="lbl">Stock</div>
              <div
                className={"gin-pile-card" + (litStock ? " lit tap" : "")}
                onClick={tapStock}
                style={{ "--cw": ccw + "px" } as CSSProperties}
              >
                {stockEmpty ? (
                  <div className="gin-pile-empty">
                    <span className="cnt">0</span>
                  </div>
                ) : (
                  <PlayingCard faceDown style={{ "--cw": ccw + "px" } as CSSProperties} />
                )}
              </div>
              <div className="cap">{state.stock.length} left</div>
            </div>
            {/* discard */}
            <div className="gin-pile">
              <div className="lbl">Discard</div>
              <div
                className={"gin-pile-card" + (litDiscard ? " lit tap" : "")}
                onClick={tapDiscardPile}
                style={{ "--cw": ccw + "px" } as CSSProperties}
              >
                {top ? (
                  <PlayingCard rank={top.rank} suit={top.suit} style={{ "--cw": ccw + "px" } as CSSProperties} />
                ) : (
                  <div className="gin-pile-empty">
                    <span className="cnt">{"—"}</span>
                  </div>
                )}
              </div>
              <div className="cap">{litDiscard ? "take" : " "}</div>
            </div>
          </div>

          {/* turn banner */}
          {banner ? (
            <div className={"gin-turn " + (banner.you ? "you" : "them")}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {banner.you ? <span className="dotline" /> : null}
                <span className="ph">{banner.ph}</span>
              </div>
              <div className="msg">{banner.msg}</div>
              {banner.you && opening ? (
                <button className="gin-pass" onClick={passUpcard}>
                  Pass
                </button>
              ) : banner.sub ? (
                <div className="sub">{banner.sub}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* your hand zone */}
        <div className="gin-hand-zone">
          <div className="gin-hand-meta">
            <div className={"gin-dw" + (dwInfo.gin ? " gin" : dwInfo.canKnock ? " ready" : "")}>
              <span className="k">{dwInfo.projected ? "DEADWOOD →" : "DEADWOOD"}</span>
              <span className="v">{dwInfo.gin ? "0" : dwInfo.value}</span>
              {dwInfo.gin ? (
                <span className="tag">GIN</span>
              ) : dwInfo.canKnock ? (
                <span className="tag">CAN KNOCK</span>
              ) : null}
            </div>
            {state.phase === "discard" && state.turn === YOU ? (
              <div className="gin-actions">
                {sel && dwInfo.canKnock ? (
                  <button className="gin-btn gold" onClick={doKnock}>
                    <span className="gl">{dwInfo.gin ? "GIN" : "KNOCK"}</span>
                  </button>
                ) : null}
                <button className="gin-btn ink" onClick={doDiscard} disabled={!sel}>
                  <span>Discard</span>
                </button>
              </div>
            ) : (
              <span className="gin-arrange-hint">
                <svg className="ic" viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4v15M4 16l3 3 3-3M17 20V5M14 8l3-3 3 3" />
                </svg>
                Drag to arrange
              </span>
            )}
          </div>

          {/* the hand — player-arranged, drag to reorder */}
          <div
            className="gin-hand"
            ref={handRef}
            style={{ "--hcw": cw + "px", height: cw * 1.4 + 22 + "px" } as CSSProperties}
          >
            {renderOrder.map((id, i) => {
              const c = byId.get(id);
              if (!c) return null;
              const dragging = id === dragId && draggedLeft != null;
              const left = dragging ? (draggedLeft as number) : fan.x0 + i * fan.step;
              return (
                <div
                  key={id + "-" + dealtKey.current}
                  className={
                    "gin-hc" +
                    (sel && cardsEqual(sel, c) ? " sel" : "") +
                    (dragging ? " dragging" : "") +
                    (meldedIds.has(id) ? " meld" : "")
                  }
                  style={{
                    left: left + "px",
                    "--hcw": cw + "px",
                    zIndex: dragging ? 60 : i,
                    transition: dragging ? "none" : undefined,
                  } as CSSProperties}
                  onPointerDown={(e) => onHandPointerDown(e, c)}
                  onPointerMove={onHandPointerMove}
                  onPointerUp={() => onHandPointerUp(c)}
                  onPointerCancel={() => {
                    dragInfo.current = null;
                    setDragId(null);
                  }}
                >
                  <PlayingCard rank={c.rank} suit={c.suit} style={{ "--cw": cw + "px" } as CSSProperties} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* round / game overlays */}
      <RoundOverlay show={overlay === "round"} state={state} onNext={nextRound} />
      <GameOverlay show={overlay === "game"} state={state} onRematch={newGame} />

      {/* how-to-play */}
      <div className={"gin-sheet" + (htp ? " show" : "")} onClick={() => setHtp(false)}>
        <div className="panel" onClick={(e) => e.stopPropagation()}>
          <div className="ph">HOW TO PLAY</div>
          <p>
            Each turn: draw a card (from the stock or the face-up discard), then discard one. Build melds
            — runs of three or more in a suit, or sets of the same rank — to shrink your deadwood (the
            point value of unmelded cards).
          </p>
          <p>
            Knock when your deadwood is 10 or under to end the hand; go gin (zero deadwood) for a 25-point
            bonus. Lowest deadwood wins the difference; undercut the knocker and you score instead. First
            to {state.target} takes the game.
          </p>
          <button className="close" onClick={() => setHtp(false)}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── melded-card ids for the gold underline (pure; cheap on a 10-card hand) ── */
function meldedCardIds(hand: Card[]): Set<string> {
  const { melds } = meldsAndDeadwood(hand);
  const ids = new Set<string>();
  for (const m of melds) for (const c of m) ids.add(cardId(c));
  return ids;
}

/* ── small mono card token (reveal line) ─────────────────────────────────── */
function CardTok({ c }: { c: Card }) {
  return (
    <span className={"gin-tok " + (isRed(c.suit) ? "red" : "black")} style={{ marginLeft: 2 }}>
      {rankLabel(c.rank)}
      <span style={{ marginLeft: 1 }}>{SUIT_CH[c.suit]}</span>
    </span>
  );
}

function revealLine(rv: RevealLine | null): { t: string; card?: Card }[] | null {
  if (!rv) return null;
  if (rv.src === "pass") return [{ t: "passed the up-card" }];
  const parts: { t: string; card?: Card }[] = [];
  if (rv.src === "discard") parts.push({ t: "took the up-card" });
  else if (rv.src === "stock") parts.push({ t: "drew from stock" });
  if (rv.discarded) parts.push({ t: rv.knocked ? "knocked, discarding " : "discarded ", card: rv.discarded });
  return parts.length ? parts : null;
}

/* ════ round-over reveal ════ */
function MiniMeldRow({ hand }: { hand: Card[] }) {
  const md = meldsAndDeadwood(hand);
  const cwm = 30;
  const groups = [
    ...md.melds.map((m) => ({ cards: m.slice().sort((a, b) => a.rank - b.rank), meld: true })),
    ...(md.deadwood.length
      ? [{ cards: md.deadwood.slice().sort((a, b) => cardValue(b) - cardValue(a)), meld: false }]
      : []),
  ];
  return (
    <div className="gin-mini">
      {groups.map((g, gi) => (
        <div key={gi} className="grp">
          {g.cards.map((c, i) => (
            <div
              key={cardId(c)}
              style={{
                marginLeft: i ? -cwm * 0.46 : 0,
                opacity: g.meld ? 1 : 0.9,
                filter: g.meld ? "none" : "saturate(.85)",
                boxShadow: g.meld
                  ? "0 1px 3px rgba(0,0,0,.25), 0 0 0 1px rgba(201,171,110,.5)"
                  : "0 1px 3px rgba(0,0,0,.2)",
                borderRadius: cwm * 0.062 + "px",
              }}
            >
              <PlayingCard rank={c.rank} suit={c.suit} style={{ "--cw": cwm + "px" } as CSSProperties} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RoundOverlay({
  show,
  state,
  onNext,
}: {
  show: boolean;
  state: GinState;
  onNext: () => void;
}) {
  const lr: RoundResult | null = state.lastRound;
  if (!lr) return <div className="gin-ov" />;
  const wash = lr.kind === "wash";
  const youKnocked = lr.knocker === YOU;
  const scorer = lr.knocker == null ? null : lr.scorer === "knocker" ? lr.knocker : ((1 - lr.knocker) as Player);
  const youScored = scorer === YOU;
  const kindLab = { knock: "KNOCK", gin: "GIN", undercut: "UNDERCUT", wash: "WASH" }[lr.kind];
  const kindColor = lr.kind === "gin" ? "#8a6d38" : lr.kind === "undercut" ? "#97331f" : "#565b64";

  let head: string;
  if (wash) head = "Stock ran out";
  else if (lr.kind === "gin") head = youKnocked ? "You went gin" : `${OPP_NAME} went gin`;
  else if (lr.kind === "undercut") head = youScored ? "You undercut" : `${OPP_NAME} undercut`;
  else head = youKnocked ? "You knocked" : `${OPP_NAME} knocked`;

  // The revealed hand: show the loser's full meld/deadwood breakdown.
  const revealHand = lr.knocker == null ? state.hands[OPP] : state.hands[lr.knocker === YOU ? OPP : YOU];

  return (
    <div className={"gin-ov" + (show ? " show" : "")}>
      <div className="gin-plate">
        <div className="gin-mk">
          <span className="dot" />
          <span className="word">KHONSERA</span>
        </div>
        <div className="gin-kind-eye" style={{ color: kindColor }}>
          {kindLab}
        </div>
        <h2>{head}</h2>
        {wash ? (
          <p>No one knocked in time. The hand is washed — deal again, scores unchanged.</p>
        ) : (
          <>
            <p>
              {youScored ? "You score " : `${OPP_NAME} scores `}
              <span style={{ fontWeight: 600, color: "#26221a" }} className="gin-tok">
                +{lr.points}
              </span>
              {lr.kind === "gin"
                ? " (deadwood + 25)"
                : lr.kind === "undercut"
                  ? " (undercut + 25)"
                  : " on the deadwood difference"}
            </p>
            <div className="gin-res">
              <div>
                <div className="k">{youKnocked ? "YOUR DW" : "THEIR DW"}</div>
                <div className="v">{lr.knockerDeadwood}</div>
              </div>
              <div>
                <div className="k">{youKnocked ? "THEIR DW" : "YOUR DW"}</div>
                <div className="v">{lr.opponentDeadwood}</div>
              </div>
              <div>
                <div className="k">POINTS</div>
                <div className="v gold">+{lr.points}</div>
              </div>
            </div>
            {lr.laidOff && lr.laidOff.length ? (
              <p className="gin-laid">
                Laid off: {lr.laidOff.map((c) => rankLabel(c.rank) + SUIT_CH[c.suit]).join("  ")}
              </p>
            ) : null}
            <div className="gin-kind-eye" style={{ color: "#9b917c", margin: "4px 0 10px" }}>
              {lr.knocker === OPP ? OPP_NAME : "Their"} hand
            </div>
            <MiniMeldRow hand={revealHand} />
          </>
        )}
        <div style={{ display: "flex", justifyContent: "center", gap: 34, margin: "20px 0 4px" }}>
          <div style={{ textAlign: "center" }}>
            <div className="k" style={{ fontSize: 9, letterSpacing: ".14em", color: "#a99e87", fontFamily: "var(--mono)" }}>
              YOU
            </div>
            <div className="gin-tok" style={{ fontSize: 22, fontWeight: 600, color: "#26221a", marginTop: 5 }}>
              {state.scores[YOU]}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="k" style={{ fontSize: 9, letterSpacing: ".14em", color: "#a99e87", fontFamily: "var(--mono)" }}>
              {OPP_NAME.toUpperCase()}
            </div>
            <div className="gin-tok" style={{ fontSize: 22, fontWeight: 600, color: "#26221a", marginTop: 5 }}>
              {state.scores[OPP]}
            </div>
          </div>
        </div>
        <button className="gin-plate-btn ink" onClick={onNext}>
          Next hand
        </button>
      </div>
    </div>
  );
}

/* ════ game-over ════ */
function GameOverlay({
  show,
  state,
  onRematch,
}: {
  show: boolean;
  state: GinState;
  onRematch: () => void;
}) {
  const youWon = state.winner === YOU;
  return (
    <div className={"gin-ov" + (show ? " show" : "")}>
      <div className="gin-plate">
        <div className="gin-mk">
          <span className="dot" />
          <span className="word">KHONSERA</span>
        </div>
        <div className="gin-kind-eye" style={{ color: "#8a6d38" }}>
          GAME OVER
        </div>
        <h2>{youWon ? "You took the game" : `${OPP_NAME} took the game`}</h2>
        <p>
          First to {state.target}. {youWon ? "Cleanly played." : "Well played — go again?"}
        </p>
        <div className="gin-res">
          <div>
            <div className="k">YOU</div>
            <div className={"v" + (youWon ? " gold" : "")}>{state.scores[YOU]}</div>
          </div>
          <div>
            <div className="k">{OPP_NAME.toUpperCase()}</div>
            <div className={"v" + (!youWon ? " gold" : "")}>{state.scores[OPP]}</div>
          </div>
        </div>
        <button className="gin-plate-btn ink" onClick={onRematch}>
          Rematch
        </button>
        <Link href={"/pastimes" as Route} className="gin-plate-btn ghost" style={{ textDecoration: "none" }}>
          Back to Pastimes
        </Link>
      </div>
    </div>
  );
}

export default GinRummyGame;
