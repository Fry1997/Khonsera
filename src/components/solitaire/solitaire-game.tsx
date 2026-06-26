/* ════════════════════════════════════════════════════════════════════════
 * Khonsera · Solitaire (Klondike) — built on the PlayingCard asset module.
 * Ported VERBATIM (behaviour) from solitaire.jsx:
 *   Pointer-drag + tap-to-foundation. Draw 1/3 toggle. Undo, moves, timer,
 *   score. Quiet premium win. State persists to localStorage.
 *
 * Pure client state — no backend. localStorage is namespaced
 * khonsera_solitaire_v2 (handoff shape: { g, draw3, elapsed }) and only
 * touched inside effects, so SSR is safe.
 * ════════════════════════════════════════════════════════════════════════ */
"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  PlayingCard,
  Suit,
  buildDeck,
  SUIT_KEYS,
  type DeckCard,
  type Rank,
  type Suit as SuitKey,
} from "./playing-card";
import "./solitaire.css";

const RED: Record<SuitKey, boolean> = { H: true, D: true, S: false, C: false };
const LS = "khonsera_solitaire_v2";

/* ── state model ──────────────────────────────────────────────────────────── */
interface Card extends DeckCard {
  up: boolean;
}

interface Game {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
  moves: number;
  score: number;
}

type Source = { type: "waste" } | { type: "tab"; col: number };

interface DragState {
  cards: Card[];
  source: Source;
  idx: number;
  dx: number;
  dy: number;
  w: number;
  x: number;
  y: number;
}

interface DownInfo {
  source: Source;
  idx: number;
  cards: Card[];
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  w: number;
  moved: boolean;
}

/* ── icons (debossed-free, simple line) ─────────────────────────────────── */
const Ico = {
  new: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5h9l5 5v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      <path d="M14 5v5h5" />
      <path d="M12 12v5M9.5 14.5h5" />
    </svg>
  ),
  undo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7 4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 0 10h-3" />
    </svg>
  ),
  recycle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9a8 8 0 0 1 14-3l2 2" />
      <path d="M20 4v5h-5" />
      <path d="M20 15a8 8 0 0 1-14 3l-2-2" />
      <path d="M4 20v-5h5" />
    </svg>
  ),
  // white flag — concede / forfeit
  forfeit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4" />
      <path d="M5 4h11l-1.5 3.5L16 11H5" />
    </svg>
  ),
};

/* ── deck / deal ─────────────────────────────────────────────────────────── */
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freshGame(): Game {
  const deck = shuffle(buildDeck().map((c) => ({ ...c, up: false }) as Card));
  const tableau: Card[][] = [[], [], [], [], [], [], []];
  let k = 0;
  for (let col = 0; col < 7; col++)
    for (let r = 0; r <= col; r++) {
      const c = deck[k++];
      c.up = r === col;
      tableau[col].push(c);
    }
  const stock = deck.slice(k).map((c) => ({ ...c, up: false }));
  return { stock, waste: [], foundations: [[], [], [], []], tableau, moves: 0, score: 0 };
}

/* ── move validation ─────────────────────────────────────────────────────── */
// Suit-locked foundations: each foundation index is bound to a fixed suit
// (SUIT_KEYS[fi] — index 0=S, 1=H, 2=D, 3=C, matching the empty-slot ghost).
// An empty foundation only accepts the Ace of its OWN suit; a non-empty pile
// already constrains both suit and ascending rank.
const foundationOk = (pile: Card[], c: Card, fi: number): boolean =>
  pile.length
    ? pile[pile.length - 1].suit === c.suit && c.rank === pile[pile.length - 1].rank + 1
    : c.rank === 1 && c.suit === SUIT_KEYS[fi];

const tableauOk = (pile: Card[], c: Card): boolean =>
  pile.length ? RED[pile[pile.length - 1].suit] !== RED[c.suit] && c.rank === pile[pile.length - 1].rank - 1 : c.rank === 13;

/* lowest face-up card index in a tableau column (the head of a movable run) */
const firstUp = (pile: Card[]): number => {
  for (let i = 0; i < pile.length; i++) if (pile[i].up) return i;
  return -1;
};

/* ── pure stuck-detection ─────────────────────────────────────────────────── */
// True if ANY legal move remains. Considers: stock still has cards (a draw is a
// move); the waste can recycle into a non-empty stock-feed; the waste top can go
// to a foundation or tableau; any tableau top can go to a foundation; any
// face-up run head can move onto another tableau column. Pure over Game.
function hasAnyLegalMove(g: Game): boolean {
  // Drawing from a non-empty stock is always available.
  if (g.stock.length) return true;
  // Stock is empty. If the waste still has buried cards beneath its top, a
  // recycle+redraw can re-expose them (and in draw-1 every buried card can
  // eventually surface), so the position is NOT provably stuck — bail out rather
  // than risk a false "no moves" nag. Only when ≤1 card is reachable do we judge.
  if (g.waste.length > 1) return true;

  const wasteTop = g.waste.length ? g.waste[g.waste.length - 1] : null;

  // waste top → foundation / tableau
  if (wasteTop) {
    for (let f = 0; f < 4; f++) if (foundationOk(g.foundations[f], wasteTop, f)) return true;
    for (let c = 0; c < g.tableau.length; c++) if (tableauOk(g.tableau[c], wasteTop)) return true;
  }

  for (let col = 0; col < g.tableau.length; col++) {
    const pile = g.tableau[col];
    if (!pile.length) continue;
    const top = pile[pile.length - 1];
    // tableau top → foundation
    if (top.up) for (let f = 0; f < 4; f++) if (foundationOk(g.foundations[f], top, f)) return true;
    // any face-up run head → another tableau column
    const head = firstUp(pile);
    if (head >= 0) {
      const runHead = pile[head];
      for (let c = 0; c < g.tableau.length; c++) {
        if (c === col) continue;
        // moving the whole column onto an empty column gains nothing; only count
        // it when the head isn't already the bottom of its own column.
        if (tableauOk(g.tableau[c], runHead)) {
          if (g.tableau[c].length || head > 0) return true;
        }
      }
    }
  }
  return false;
}

const clone = (g: Game): Game => ({
  stock: g.stock.map((c) => ({ ...c })),
  waste: g.waste.map((c) => ({ ...c })),
  foundations: g.foundations.map((p) => p.map((c) => ({ ...c }))),
  tableau: g.tableau.map((p) => p.map((c) => ({ ...c }))),
  moves: g.moves,
  score: g.score,
});

interface Saved {
  g?: Game;
  draw3?: boolean;
  elapsed?: number;
}

/* read the saved snapshot synchronously (client-only — this component is mounted
 * with ssr:false, so the lazy initializers below never run on the server and a
 * hydration mismatch is impossible). Restoring *before* first paint removes the
 * window in which a throwaway fresh game could be persisted over a real save —
 * that race (a guarded `hydrated` flag + a fresh-game write firing before the
 * async restore effect landed) was why a game in progress did not survive a
 * reload. */
function readSaved(): Saved | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(LS) || "null");
  } catch {
    return null;
  }
}

/* ════════════════════════════════════════════════════════════════════════ */
export function SolitaireGame() {
  // Restore synchronously in the lazy initializers (ssr:false ⇒ client-only ⇒
  // no SSR markup to mismatch). No async restore effect, no hydration flag.
  // saved0 is read once at first render; the initializers below all read it.
  const saved0 = useRef<Saved | null>(null);
  if (saved0.current === null) saved0.current = readSaved() ?? {};
  const [g, setG] = useState<Game>(() => saved0.current?.g ?? freshGame());
  const [draw3, setDraw3] = useState<boolean>(() => !!saved0.current?.draw3);
  const [elapsed, setElapsed] = useState<number>(() =>
    saved0.current?.elapsed ? (saved0.current.elapsed | 0) : 0,
  );
  const [hist, setHist] = useState<Game[]>([]);
  const [won, setWon] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  // Has the player committed to this deal yet? Drives the Draw 1/3 toggle lock
  // (cannot change draw-count mid-game) and the forfeit confirm. A restored game
  // with moves already made counts as underway.
  const [confirmForfeit, setConfirmForfeit] = useState(false);

  const gRef = useRef(g);
  gRef.current = g;
  const boardRef = useRef<HTMLDivElement | null>(null);
  const pileRefs = useRef<Record<string, HTMLElement | null>>({});
  // Resume the timer for a restored game-in-progress (moves already made).
  const running = useRef(g.moves > 0);

  const wonNow = g.foundations.reduce((n, p) => n + p.length, 0) === 52;
  // The deal is "underway" once any move/draw has happened — the draw-count
  // toggle locks at that point and only frees again on a New deal / forfeit.
  const underway = g.moves > 0;

  /* timer */
  useEffect(() => {
    if (wonNow) {
      running.current = false;
      return;
    }
    const id = setInterval(() => {
      if (running.current) setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [wonNow]);

  useEffect(() => {
    if (wonNow && !won) {
      setWon(true);
      running.current = false;
    }
  }, [wonNow, won]);

  /* persist — restore happens synchronously in the state initializers, so every
   * write here is a real game state (no throwaway fresh-game-over-save race). */
  useEffect(() => {
    try {
      localStorage.setItem(LS, JSON.stringify({ g, draw3, elapsed }));
    } catch {
      /* ignore */
    }
  }, [g, draw3, elapsed]);

  /* commit a new state, pushing previous to history */
  const commit = useCallback((next: Game, scoreDelta = 0) => {
    running.current = true;
    setHist((h) => [...h.slice(-60), clone(gRef.current)]);
    next.moves += 1;
    next.score = Math.max(0, next.score + scoreDelta);
    setG(next);
  }, []);

  const newGame = useCallback(() => {
    setHist([]);
    setWon(false);
    setElapsed(0);
    setConfirmForfeit(false);
    running.current = false;
    setG(freshGame());
  }, []);

  // Forfeit = concede the current deal and start fresh. Same reset as New; the
  // surface guards it behind a confirm so it isn't hit by accident.
  const forfeit = useCallback(() => {
    setConfirmForfeit(false);
    newGame();
  }, [newGame]);

  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setG(prev);
      setWon(false);
      return h.slice(0, -1);
    });
  }, []);

  /* draw / recycle */
  const drawStock = useCallback(() => {
    const cur = clone(gRef.current);
    if (!cur.stock.length) {
      if (!cur.waste.length) return;
      cur.stock = cur.waste.reverse().map((c) => ({ ...c, up: false }));
      cur.waste = [];
      commit(cur, 0);
      return;
    }
    const n = draw3 ? 3 : 1;
    for (let i = 0; i < n && cur.stock.length; i++) {
      const c = cur.stock.pop()!;
      c.up = true;
      cur.waste.push(c);
    }
    commit(cur, 0);
  }, [draw3, commit]);

  /* auto-send a card to a foundation (tap) */
  const flyHome = useCallback(
    (source: Source): boolean => {
      const cur = clone(gRef.current);
      let card: Card | null = null;
      let pile: Card[] | null = null;
      if (source.type === "waste") {
        if (!cur.waste.length) return false;
        pile = cur.waste;
        card = pile[pile.length - 1];
      } else if (source.type === "tab") {
        pile = cur.tableau[source.col];
        if (!pile.length) return false;
        card = pile[pile.length - 1];
        if (!card.up) return false;
      } else {
        return false;
      }
      for (let f = 0; f < 4; f++) {
        if (foundationOk(cur.foundations[f], card, f)) {
          pile.pop();
          cur.foundations[f].push(card);
          let sc = 10;
          if (source.type === "tab") {
            const p = cur.tableau[source.col];
            if (p.length && !p[p.length - 1].up) {
              p[p.length - 1].up = true;
              sc += 5;
            }
          }
          commit(cur, sc);
          setFlash(f);
          setTimeout(() => setFlash(null), 500);
          return true;
        }
      }
      return false;
    },
    [commit],
  );

  /* ── pointer drag ──────────────────────────────────────────────────────── */
  const downInfo = useRef<DownInfo | null>(null);

  const applyMove = useCallback(
    (source: Source, idx: number, cards: Card[], targetKey: string) => {
      const cur = clone(gRef.current);
      const [tt, ti] = targetKey.split(":");
      const moving = cards.map((c) => ({ ...c }));
      const removeFromSource = () => {
        if (source.type === "waste") cur.waste.pop();
        else cur.tableau[source.col].splice(idx);
      };
      let scoreDelta = 0;
      if (tt === "f") {
        if (moving.length !== 1) return;
        const fi = +ti;
        if (!foundationOk(cur.foundations[fi], moving[0], fi)) return;
        removeFromSource();
        cur.foundations[fi].push(moving[0]);
        scoreDelta += 10;
        setFlash(fi);
        setTimeout(() => setFlash(null), 500);
      } else if (tt === "t") {
        const col = +ti;
        if (source.type === "tab" && source.col === col) return;
        if (!tableauOk(cur.tableau[col], moving[0])) return;
        removeFromSource();
        cur.tableau[col].push(...moving);
        if (source.type === "waste") scoreDelta += 5;
      } else {
        return;
      }
      // flip newly exposed tableau card
      if (source.type === "tab") {
        const p = cur.tableau[source.col];
        if (p.length && !p[p.length - 1].up) {
          p[p.length - 1].up = true;
          scoreDelta += 5;
        }
      }
      commit(cur, scoreDelta);
    },
    [commit],
  );

  const hitTest = useCallback((x: number, y: number): string | null => {
    let best: { key: string; dist: number } | null = null;
    for (const key in pileRefs.current) {
      const el = pileRefs.current[key];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // expand a touch for forgiving drops (esp. +80px below tall columns)
      if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 80) {
        const cx = r.left + r.width / 2,
          cy = r.top + r.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        if (!best || dist < best.dist) best = { key, dist };
      }
    }
    return best ? best.key : null;
  }, []);

  const onMove = useCallback((e: PointerEvent) => {
    const d = downInfo.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < 5 && Math.abs(e.clientY - d.startY) < 5) return;
      d.moved = true;
      setDrag({
        cards: d.cards,
        source: d.source,
        idx: d.idx,
        dx: d.dx,
        dy: d.dy,
        w: d.w,
        x: e.clientX,
        y: e.clientY,
      });
    }
    setDrag((s) => (s ? { ...s, x: e.clientX, y: e.clientY } : s));
  }, []);

  const onUp = useCallback(
    (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const d = downInfo.current;
      downInfo.current = null;
      if (!d) return;
      if (!d.moved) {
        // tap → try foundation
        setDrag(null);
        flyHome(d.source.type === "tab" ? { type: "tab", col: d.source.col } : { type: "waste" });
        return;
      }
      // find drop target under pointer
      const target = hitTest(e.clientX, e.clientY);
      setDrag(null);
      if (!target) return;
      applyMove(d.source, d.idx, d.cards, target);
    },
    [onMove, flyHome, hitTest, applyMove],
  );

  const beginGrab = useCallback(
    (source: Source, idx: number, e: ReactPointerEvent<HTMLDivElement>) => {
      const cur = gRef.current;
      let cards: Card[];
      if (source.type === "waste") {
        const c = cur.waste[cur.waste.length - 1];
        if (!c) return;
        cards = [c];
      } else {
        const pile = cur.tableau[source.col];
        const c = pile[idx];
        if (!c || !c.up) return;
        cards = pile.slice(idx);
      }
      const cardEl = e.currentTarget;
      const rect = cardEl.getBoundingClientRect();
      downInfo.current = {
        source,
        idx,
        cards,
        startX: e.clientX,
        startY: e.clientY,
        dx: e.clientX - rect.left,
        dy: e.clientY - rect.top,
        w: rect.width,
        moved: false,
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [onMove, onUp],
  );

  /* ── responsive card width ─────────────────────────────────────────────── */
  const [cw, setCw] = useState(70);
  useLayoutEffect(() => {
    const fit = () => {
      const el = boardRef.current;
      if (!el) return;
      const W = el.clientWidth,
        H = el.clientHeight;
      // Size cards by WIDTH so the 7 columns fill the screen — big in landscape,
      // as large as a phone's width allows in portrait. padding is 8px each side
      // (16 total); 7 columns + 6 gaps where gap = 0.12cw → 7 + 6·0.12 = 7.72cw.
      // We deliberately do NOT clamp to the height anymore (that pre-shrank every
      // card to fit a worst-case-long column on one screen, wasting the felt and
      // making landscape tiny). Long columns scroll instead (the board is
      // overflow-y:auto, stock/foundations pinned). A soft floor on height keeps
      // a fresh deal fully visible without scrolling on a normal screen.
      const byW = (W - 16) / 7.72;
      let v = Math.max(40, Math.min(byW, 150));
      v = Math.floor(v);
      setCw((prev) => (prev === v ? prev : v));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (boardRef.current) ro.observe(boardRef.current);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  const gap = Math.round(cw * 0.12);
  const downFan = cw * 0.2,
    upFan = cw * 0.34;

  /* helper: cumulative top offsets for a tableau column */
  const colOffsets = (pile: Card[]) => {
    const tops: number[] = [];
    let t = 0;
    for (let i = 0; i < pile.length; i++) {
      tops.push(t);
      t += pile[i].up ? upFan : downFan;
    }
    return { tops, height: t + cw * 1.4 };
  };

  const setPileRef = (key: string) => (el: HTMLElement | null) => {
    pileRefs.current[key] = el;
  };

  const fmtTime = (s: number) => `${(s / 60) | 0}:${String(s % 60).padStart(2, "0")}`;

  // Stuck: no legal move remains and the game isn't already won. Surfaced as a
  // quiet notice (not a nag) offering a New deal / forfeit.
  const stuck = !wonNow && !hasAnyLegalMove(g);

  /* drag-source matching (to hide originals) */
  const isDragSrc = (type: "waste" | "tab", col: number, idx: number): boolean => {
    if (!drag) return false;
    if (type === "waste") return drag.source.type === "waste";
    return drag.source.type === "tab" && drag.source.col === col && idx >= drag.idx;
  };

  return (
    <div className="solitaire-felt">
      <div className="bar">
        <div className="brand">
          <span className="dot" />
          <span className="word">Khonsera</span>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="k">Moves</div>
            <div className="v">{g.moves}</div>
          </div>
          <div className="stat">
            <div className="k">Time</div>
            <div className="v">{fmtTime(elapsed)}</div>
          </div>
          <div className="stat score">
            <div className="k">Score</div>
            <div className="v">{g.score}</div>
          </div>
        </div>
        <div className="tools">
          <button
            className="tool toggle"
            onClick={() => !underway && setDraw3((d) => !d)}
            disabled={underway}
            title={underway ? "Draw mode locks once the deal is underway" : "Draw mode"}
          >
            <span className={"seg" + (!draw3 ? " on" : "")}>1</span>
            <span className={"seg" + (draw3 ? " on" : "")}>3</span>
          </button>
          <button className="tool" onClick={undo} disabled={!hist.length} title="Undo">
            {Ico.undo}
          </button>
          <button
            className="tool"
            onClick={() => (underway ? setConfirmForfeit(true) : undefined)}
            disabled={!underway}
            title="Forfeit this game"
          >
            {Ico.forfeit}
            <span className="label">Forfeit</span>
          </button>
          <button className="tool" onClick={newGame} title="New game">
            {Ico.new}
            <span className="label">New</span>
          </button>
        </div>
      </div>

      <div
        className="board"
        ref={boardRef}
        style={
          {
            "--cw": cw + "px",
            "--gap": gap + "px",
            maxWidth: 7.72 * cw + 16 + "px",
          } as CSSProperties
        }
      >
        {/* top row */}
        <div className="toprow">
          {/* stock */}
          <div className="col" style={{ height: cw * 1.4 }}>
            <div
              className={"slot" + (!g.stock.length ? " recycle" : "")}
              ref={setPileRef("stock")}
              onClick={drawStock}
              style={{ cursor: "pointer" }}
            >
              {!g.stock.length && <div className="recycle-ic">{Ico.recycle}</div>}
            </div>
            {g.stock.length > 0 && (
              <div className="pc" style={{ top: 0, zIndex: 2 }} onClick={drawStock}>
                <PlayingCard faceDown />
              </div>
            )}
          </div>
          {/* waste */}
          <div className="col" style={{ height: cw * 1.4 }}>
            <div className="slot" />
            {g.waste.slice(-3).map((c, i, arr) => {
              const isTop = i === arr.length - 1;
              const off = draw3 ? i * (cw * 0.26) : 0;
              return (
                <div
                  key={c.id}
                  className={"pc" + (isTop ? " grabbable playable lift" : "")}
                  style={{ left: off, top: 0, zIndex: 2 + i }}
                  onPointerDown={isTop ? (e) => beginGrab({ type: "waste" }, 0, e) : undefined}
                >
                  <PlayingCard rank={c.rank as Rank} suit={c.suit} />
                </div>
              );
            })}
          </div>
          {/* spacer + foundations */}
          <div className="foundations">
            {g.foundations.map((pile, f) => {
              const top = pile[pile.length - 1];
              // Light a foundation only when the dragged single card is a legal
              // drop there — which now respects the suit lock (an Ace lights only
              // its own suit's empty slot).
              const lit =
                !!drag && drag.cards.length === 1 && foundationOk(pile, drag.cards[0], f);
              return (
                <div
                  key={f}
                  className={"slot" + (flash === f ? " flash" : "") + (lit ? " lit" : "")}
                  ref={setPileRef("f:" + f)}
                >
                  {!pile.length && (
                    <div className="ghost">
                      <Suit s={SUIT_KEYS[f]} />
                    </div>
                  )}
                  {top && (
                    <div className="pc" style={{ top: 0 }}>
                      <PlayingCard rank={top.rank as Rank} suit={top.suit} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* tableau */}
        <div className="tableau">
          {g.tableau.map((pile, col) => {
            const { tops, height } = colOffsets(pile);
            return (
              <div
                key={col}
                className="col"
                ref={setPileRef("t:" + col)}
                style={{ minHeight: cw * 1.4, height }}
              >
                <div className="slot" style={{ position: "absolute", top: 0 }} />
                {pile.map((c, idx) => {
                  const top = tops[idx];
                  const isTop = idx === pile.length - 1;
                  const movable = c.up;
                  return (
                    <div
                      key={c.id}
                      className={
                        "pc" + (movable ? " grabbable" : "") + (isTop && c.up ? " playable lift" : "")
                      }
                      style={{
                        top,
                        zIndex: idx + 1,
                        opacity: isDragSrc("tab", col, idx) ? 0 : 1,
                      }}
                      onPointerDown={movable ? (e) => beginGrab({ type: "tab", col }, idx, e) : undefined}
                    >
                      <PlayingCard rank={c.rank as Rank} suit={c.suit} faceDown={!c.up} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* drag layer */}
      {drag && (
        <div className="draglayer" style={{ "--cw": cw + "px" } as CSSProperties}>
          {drag.cards.map((c, i) => (
            <div
              key={c.id}
              className="pc lift"
              style={{ left: drag.x - drag.dx, top: drag.y - drag.dy + i * upFan }}
            >
              <PlayingCard rank={c.rank as Rank} suit={c.suit} />
            </div>
          ))}
        </div>
      )}

      {/* win */}
      <div className={"win" + (won ? " show" : "")}>
        <div className="plate">
          <div className="mk">
            <span className="dot" />
            <span className="word">Khonsera</span>
          </div>
          <h2>Day complete.</h2>
          <p>Every card home, in order.</p>
          <div className="res">
            <div>
              <div className="k">Time</div>
              <div className="v">{fmtTime(elapsed)}</div>
            </div>
            <div>
              <div className="k">Moves</div>
              <div className="v">{g.moves}</div>
            </div>
            <div>
              <div className="k">Score</div>
              <div className="v">{g.score}</div>
            </div>
          </div>
          <button className="again" onClick={newGame}>
            New game
          </button>
        </div>
      </div>

      {/* no-moves notice — quiet, not a nag; only while the win isn't showing */}
      {stuck && !won && (
        <div className="notice" role="status">
          <span className="msg">No moves left.</span>
          <button className="ndeal" onClick={newGame}>
            New deal
          </button>
        </div>
      )}

      {/* forfeit confirm */}
      <div className={"confirm" + (confirmForfeit ? " show" : "")}>
        <div className="cplate">
          <h3>Forfeit this game?</h3>
          <p>This deal is conceded and a fresh one begins. There is no undo.</p>
          <div className="crow">
            <button className="cbtn ghost" onClick={() => setConfirmForfeit(false)}>
              Keep playing
            </button>
            <button className="cbtn" onClick={forfeit}>
              Forfeit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SolitaireGame;
