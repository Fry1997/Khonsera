/* ════════════════════════════════════════════════════════════════════════
 * Khonsera · Playing-card asset module (TS/React port of cards.jsx)
 * One beautiful, correctly-proportioned card. Poker ratio 2.5:3.5 (h = 1.4w).
 * Cotton stock, fibre tooth, letterpress-debossed pips & indices. Crisp SVG
 * suits. Everything scales from a single --cw (card width) set on an ancestor.
 *
 * The face stylesheet lives in playing-card.css; the literal colours/geometry
 * there are intentional game-local values (see the note at the top of that
 * file). This module owns the markup + the SUIT_PATH SVGs (kept VERBATIM from
 * the handoff — substituting them reintroduces the deboss "ghost-stem" artifact).
 *
 * Reusable across future card games (Spider, FreeCell, …) — no game logic here.
 * ════════════════════════════════════════════════════════════════════════ */
import { memo, type CSSProperties, type PointerEventHandler } from "react";
import "./playing-card.css";

export type Suit = "S" | "H" | "D" | "C";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface DeckCard {
  rank: Rank;
  suit: Suit;
  id: string;
}

/* ── suit geometry (viewBox 0 0 100 100) — VERBATIM from cards.jsx ───────── */
export const SUIT_PATH: Record<Suit, string> = {
  S: "M50 14 C49 31 19 36 19 56 C19 67 27 73 36 73 C41 73 46 70 49 66 C48 76 44 87 36 92 L64 92 C56 87 52 76 51 66 C54 70 59 73 64 73 C73 73 81 67 81 56 C81 36 51 31 50 14 Z",
  H: "M50 89C19 64 7 48 7 30 7 17 17 8 29 8c9 0 16 5 21 14 5-9 12-14 21-14 12 0 22 9 22 22 0 18-12 34-43 59z",
  D: "M50 6 89 50 50 94 11 50z",
  C: "M33 32 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 z M16 56 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 z M50 56 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 z M35 47 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0 z M46 58 C46 71 43 82 37 89 L63 89 C57 82 54 71 54 58 Z",
};

const RED: Record<Suit, boolean> = { H: true, D: true, S: false, C: false };
const RANK: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };

export const rankLabel = (r: number): string => RANK[r] || String(r);

export const SUIT_KEYS: Suit[] = ["S", "H", "D", "C"];

export function buildDeck(): DeckCard[] {
  const d: DeckCard[] = [];
  for (const s of SUIT_KEYS) {
    for (let r = 1; r <= 13; r++) d.push({ rank: r as Rank, suit: s, id: s + r });
  }
  return d;
}

/* ── suit svg ────────────────────────────────────────────────────────────── */
export function Suit({
  s,
  cls,
  style,
}: {
  s: Suit;
  cls?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={"kc-suit" + (cls ? " " + cls : "")}
      viewBox="0 0 100 100"
      style={style}
      aria-hidden="true"
    >
      <path d={SUIT_PATH[s]} />
    </svg>
  );
}

/* ── pip layouts (x,y as fractions of the pip field; y>0.5 ⇒ rotated) ─────── */
const COL_L = 0.18,
  COL_C = 0.5,
  COL_R = 0.82;

type Pip = [number, number] | [number, number, "ace"];

const PIPS: Record<number, Pip[]> = {
  1: [[COL_C, 0.5, "ace"]],
  2: [[COL_C, 0.06], [COL_C, 0.94]],
  3: [[COL_C, 0.06], [COL_C, 0.5], [COL_C, 0.94]],
  4: [[COL_L, 0.06], [COL_R, 0.06], [COL_L, 0.94], [COL_R, 0.94]],
  5: [[COL_L, 0.06], [COL_R, 0.06], [COL_C, 0.5], [COL_L, 0.94], [COL_R, 0.94]],
  6: [[COL_L, 0.06], [COL_R, 0.06], [COL_L, 0.5], [COL_R, 0.5], [COL_L, 0.94], [COL_R, 0.94]],
  7: [[COL_L, 0.06], [COL_R, 0.06], [COL_C, 0.28], [COL_L, 0.5], [COL_R, 0.5], [COL_L, 0.94], [COL_R, 0.94]],
  8: [[COL_L, 0.06], [COL_R, 0.06], [COL_C, 0.28], [COL_L, 0.5], [COL_R, 0.5], [COL_C, 0.72], [COL_L, 0.94], [COL_R, 0.94]],
  9: [[COL_L, 0.06], [COL_R, 0.06], [COL_L, 0.37], [COL_R, 0.37], [COL_C, 0.5], [COL_L, 0.63], [COL_R, 0.63], [COL_L, 0.94], [COL_R, 0.94]],
  10: [[COL_L, 0.06], [COL_R, 0.06], [COL_C, 0.21], [COL_L, 0.37], [COL_R, 0.37], [COL_L, 0.63], [COL_R, 0.63], [COL_C, 0.79], [COL_L, 0.94], [COL_R, 0.94]],
};

function Corner({ lab, s }: { lab: string; s: Suit }) {
  return (
    <div className="kc-idx">
      <span className="kc-r">{lab}</span>
      <Suit s={s} cls="kc-cs" />
    </div>
  );
}

export function Face({ rank, suit }: { rank: Rank; suit: Suit }) {
  const lab = rankLabel(rank);
  const corners = (
    <>
      <div className="kc-corner tl">
        <Corner lab={lab} s={suit} />
      </div>
      <div className="kc-corner br">
        <Corner lab={lab} s={suit} />
      </div>
    </>
  );

  let body: React.ReactNode;
  if (rank === 1) {
    // Ace — single ornamental central suit
    body = (
      <div className="kc-ace">
        {suit === "S" ? <span className="kc-ace-ring" /> : null}
        <Suit s={suit} cls="kc-ace-suit" />
      </div>
    );
  } else if (rank >= 11) {
    // Court — open ornamental rank letter between a mirrored suit pair
    body = (
      <div className="kc-court">
        <Suit s={suit} cls="kc-court-suit top" />
        <span className="kc-court-letter">{lab}</span>
        <Suit s={suit} cls="kc-court-suit bot" />
      </div>
    );
  } else {
    // number — pip grid
    body = (
      <div className="kc-pips">
        {PIPS[rank].map((p, i) => {
          const rotated = p[1] > 0.5;
          const big = p[2] === "ace";
          return (
            <Suit
              key={i}
              s={suit}
              cls={"kc-pip" + (big ? " big" : "")}
              style={{
                left: p[0] * 100 + "%",
                top: p[1] * 100 + "%",
                transform: `translate(-50%,-50%) rotate(${rotated ? 180 : 0}deg)`,
              }}
            />
          );
        })}
      </div>
    );
  }

  return <div className={"kc-face" + (RED[suit] ? " red" : "")}>{corners}{body}</div>;
}

export function Back() {
  return (
    <div className="kc-back">
      <span className="kc-back-field" />
      <span className="kc-back-frame" />
    </div>
  );
}

export interface PlayingCardProps {
  rank?: Rank;
  suit?: Suit;
  faceDown?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
}

// Memoised: the card face is pure over its props. In the game, a single move
// re-renders the whole board tree; without this every one of the 52 card faces
// (each a non-trivial SVG/pip subtree) re-renders, which is the main source of
// the sluggish tap/drag feel. memo lets unaffected cards bail out so only the
// moved cards repaint, keeping interaction snappy.
export const PlayingCard = memo(function PlayingCard({
  rank,
  suit,
  faceDown,
  className,
  style,
  onClick,
  onPointerDown,
}: PlayingCardProps) {
  return (
    <div
      className={"kc-card" + (faceDown ? " down" : "") + (className ? " " + className : "")}
      style={style}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      {faceDown || rank === undefined || suit === undefined ? (
        <Back />
      ) : (
        <Face rank={rank} suit={suit} />
      )}
    </div>
  );
});

export default PlayingCard;
