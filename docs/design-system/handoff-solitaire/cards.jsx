/* ════════════════════════════════════════════════════════════════════════
 * Khonsera · Playing-card asset module
 * One beautiful, correctly-proportioned card. Poker ratio 2.5:3.5 (h = 1.4w).
 * Cotton stock, fibre tooth, letterpress-debossed pips & indices. Crisp SVG
 * suits. Courts get a framed medallion; aces a single ornamental suit.
 * Everything scales from a single --cw (card width) set on the wrapper.
 *
 * Usage:  const { Card, Deck } = window.KhonseraCards;
 *         <Card rank={1} suit="S" />            // ace of spades, face up
 *         <Card rank={13} suit="H" />
 *         set width with style={{ ['--cw']: '220px' }} on the card or an ancestor
 * ════════════════════════════════════════════════════════════════════════ */
(function () {
  const R = window.React;
  if (!R) { console.error("KhonseraCards: React not found"); return; }
  const h = R.createElement;

  /* ── suit geometry (viewBox 0 0 100 100) ──────────────────────────────── */
  const SUIT_PATH = {
    S: "M50 14 C49 31 19 36 19 56 C19 67 27 73 36 73 C41 73 46 70 49 66 C48 76 44 87 36 92 L64 92 C56 87 52 76 51 66 C54 70 59 73 64 73 C73 73 81 67 81 56 C81 36 51 31 50 14 Z",
    H: "M50 89C19 64 7 48 7 30 7 17 17 8 29 8c9 0 16 5 21 14 5-9 12-14 21-14 12 0 22 9 22 22 0 18-12 34-43 59z",
    D: "M50 6 89 50 50 94 11 50z",
    C: "M33 32 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 z M16 56 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 z M50 56 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 z M35 47 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0 z M46 58 C46 71 43 82 37 89 L63 89 C57 82 54 71 54 58 Z",
  };
  const RED = { H: true, D: true, S: false, C: false };
  const RANK = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  const rankLabel = (r) => RANK[r] || String(r);

  function Suit({ s, cls, style }) {
    return h("svg", { className: "kc-suit" + (cls ? " " + cls : ""), viewBox: "0 0 100 100", style, "aria-hidden": "true" },
      h("path", { d: SUIT_PATH[s] }));
  }

  /* ── pip layouts (x,y as fractions of the pip field; y>0.5 ⇒ rotated) ──── */
  const COL_L = 0.18, COL_C = 0.5, COL_R = 0.82;
  const PIPS = {
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

  function Corner({ lab, s }) {
    return h("div", { className: "kc-idx" },
      h("span", { className: "kc-r" }, lab),
      h(Suit, { s, cls: "kc-cs" }));
  }

  function Face({ rank, suit }) {
    const lab = rankLabel(rank);
    const corners = h(R.Fragment, null,
      h("div", { className: "kc-corner tl" }, h(Corner, { lab, s: suit })),
      h("div", { className: "kc-corner br" }, h(Corner, { lab, s: suit })));

    let body;
    if (rank === 1) {
      // Ace — single ornamental central suit
      body = h("div", { className: "kc-ace" },
        suit === "S" ? h("span", { className: "kc-ace-ring" }) : null,
        h(Suit, { s: suit, cls: "kc-ace-suit" }));
    } else if (rank >= 11) {
      // Court — open ornamental rank letter between a mirrored suit pair
      body = h("div", { className: "kc-court" },
        h(Suit, { s: suit, cls: "kc-court-suit top" }),
        h("span", { className: "kc-court-letter" }, lab),
        h(Suit, { s: suit, cls: "kc-court-suit bot" }));
    } else {
      // number — pip grid
      body = h("div", { className: "kc-pips" },
        PIPS[rank].map((p, i) => {
          const rotated = p[1] > 0.5;
          const big = p[2] === "ace";
          return h(Suit, {
            key: i, s: suit, cls: "kc-pip" + (big ? " big" : ""),
            style: {
              left: (p[0] * 100) + "%", top: (p[1] * 100) + "%",
              transform: `translate(-50%,-50%) rotate(${rotated ? 180 : 0}deg)`,
            },
          });
        }));
    }
    return h("div", { className: "kc-face" + (RED[suit] ? " red" : "") }, corners, body);
  }

  function Back() {
    return h("div", { className: "kc-back" },
      h("span", { className: "kc-back-field" }),
      h("span", { className: "kc-back-frame" }));
  }

  function Card({ rank, suit, faceDown, className, style, onClick }) {
    return h("div", {
      className: "kc-card" + (faceDown ? " down" : "") + (className ? " " + className : ""),
      style, onClick,
    }, faceDown ? h(Back) : h(Face, { rank, suit }));
  }

  /* ── stylesheet (injected once) ──────────────────────────────────────── */
  const CSS = `
  .kc-card{
    position:relative; width:var(--cw,200px); height:calc(var(--cw,200px)*1.4);
    border-radius:calc(var(--cw,200px)*0.062); font-size:calc(var(--cw,200px)*0.1);
    -webkit-user-select:none; user-select:none; flex:0 0 auto;
    --paper:#f6f3ec; --paper-2:#efe9dd; --ink:#26211a; --faint:#9a9082;
    --red:#a23528; --red-deep:#7f2b22; --gold:#93753c;
    /* tone-on-tone press: glyphs are the stock itself, recessed */
    --press:#d7cebd; --press-edge:rgba(86,71,46,0.42);
    /* deboss offset, scales with card size so the carve reads at any --cw */
    --db:calc(var(--cw,200px)*0.011);
  }
  /* ───── face ───── */
  .kc-face{
    position:absolute; inset:0; border-radius:inherit; overflow:hidden;
    background:
      linear-gradient(150deg, #fbf9f4 0%, var(--paper) 46%, var(--paper-2) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.95),
      inset 0 -1px 2px rgba(120,104,78,0.10),
      inset 0 0 0 1px rgba(255,255,255,0.5),
      0 1px 1px rgba(40,30,15,0.10),
      0 calc(var(--cw,200px)*0.018) calc(var(--cw,200px)*0.05) rgba(40,30,15,0.18);
    color:var(--ink);
  }
  /* cotton weave — edge to edge, BENEATH the printed ink (real stock is woven
     first, then printed) so pips/letters stay solid and crisp on top */
  .kc-face::before{
    content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
    z-index:0; --wv:calc(var(--cw,200px)*0.0235);
    background-image:
      repeating-linear-gradient(45deg, rgba(255,255,255,0.72) 0, rgba(255,255,255,0.72) calc(var(--wv)*0.16), transparent calc(var(--wv)*0.16), transparent calc(var(--wv)*0.5), rgba(122,104,74,0.17) calc(var(--wv)*0.5), rgba(122,104,74,0.17) calc(var(--wv)*0.66), transparent calc(var(--wv)*0.66), transparent var(--wv)),
      repeating-linear-gradient(-45deg, rgba(255,255,255,0.72) 0, rgba(255,255,255,0.72) calc(var(--wv)*0.16), transparent calc(var(--wv)*0.16), transparent calc(var(--wv)*0.5), rgba(122,104,74,0.17) calc(var(--wv)*0.5), rgba(122,104,74,0.17) calc(var(--wv)*0.66), transparent calc(var(--wv)*0.66), transparent var(--wv));
    opacity:.5;
  }
  .kc-face::after{
    content:""; position:absolute; inset:calc(var(--cw,200px)*0.04); border-radius:calc(var(--cw,200px)*0.03);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.7),
      inset 0 0 0 1px rgba(150,134,104,0.16),
      inset 0 2px 3px rgba(120,104,78,0.06);
    pointer-events:none;
  }
  .kc-face.red{ --suit:#a8503c; --suit-top:#6d2a1d; --suit-bot:#c2705a; --suit-edge:rgba(96,33,22,0.55); }
  .kc-face:not(.red){ --suit:#3a332a; --suit-top:#14100a; --suit-bot:#5a5046; --suit-edge:rgba(22,16,9,0.6); }

  /* ───── suit svg ───── */
  .kc-suit{ display:block; }
  .kc-suit path{ fill:var(--suit); }
  /* coloured blind deboss: crisp dark top bite + bright lower rim — zero-blur
     so tight concavities (spade/club stems) stay clean and don't read split */
  .kc-face .kc-suit{
    filter:
      drop-shadow(0 calc(var(--db)*-0.45) calc(var(--db)*0.9) var(--suit-edge))
      drop-shadow(0 calc(var(--db)*0.5) calc(var(--db)*1.1) rgba(255,255,255,0.85));
  }

  /* ───── corner index ───── */
  .kc-corner{ position:absolute; display:flex; z-index:2; }
  .kc-corner.tl{ top:calc(var(--cw,200px)*0.092); left:calc(var(--cw,200px)*0.10); }
  .kc-corner.br{ bottom:calc(var(--cw,200px)*0.092); right:calc(var(--cw,200px)*0.10); transform:rotate(180deg); }
  .kc-idx{ display:flex; flex-direction:column; align-items:center; line-height:0.88; }
  .kc-r{
    font-family:"Satoshi","Inter",sans-serif; font-weight:600;
    font-size:1.18em; letter-spacing:-0.02em; color:var(--suit);
    text-shadow:0 calc(var(--db)*0.55) calc(var(--db)*1.1) rgba(255,255,255,0.9), 0 calc(var(--db)*-0.45) calc(var(--db)*0.9) var(--suit-edge);
  }
  .kc-cs{ width:0.82em; height:0.82em; margin-top:0.12em; }

  /* ───── pips ───── */
  .kc-pips{ position:absolute; left:24%; right:24%; top:12%; bottom:12%; z-index:2; }
  .kc-pip{ position:absolute; width:1.42em; height:1.42em; }
  .kc-pip.big{ width:3.4em; height:3.4em; }

  /* ───── ace ───── */
  .kc-ace{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:2; }
  .kc-ace-suit{ width:46%; height:46%; }
  .kc-ace-ring{
    position:absolute; width:62%; height:44%;
    border-radius:50%/50%;
    box-shadow:
      inset 0 0 0 1px rgba(150,134,104,0.30),
      inset 0 1px 0 rgba(255,255,255,0.7),
      0 1px 0 rgba(255,255,255,0.6);
    border:1px solid transparent;
  }
  .kc-ace-ring::before{
    content:""; position:absolute; inset:6%; border-radius:inherit;
    box-shadow:inset 0 0 0 1px rgba(150,134,104,0.18);
  }

  /* ───── court — open ornamental letter, no frame ───── */
  .kc-court{
    position:absolute; inset:11% 0; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:0.18em; z-index:2;
  }
  .kc-court-suit{ width:1.4em; height:1.4em; flex:0 0 auto; }
  .kc-court-suit.bot{ transform:rotate(180deg); }
  .kc-court-letter{
    font-family:"Satoshi","Inter",sans-serif; font-weight:400; font-size:3.5em;
    line-height:0.9; color:var(--suit); letter-spacing:-0.04em;
    text-shadow:0 calc(var(--db)*0.6) calc(var(--db)*1.2) rgba(255,255,255,0.9), 0 calc(var(--db)*-0.5) calc(var(--db)*1.0) var(--suit-edge);
  }

  /* ───── back (opt-in via faceDown) — debossed diamond lattice on cotton ───── */
  .kc-card.down .kc-back{
    position:absolute; inset:0; border-radius:inherit; overflow:hidden;
    background:linear-gradient(150deg, #fbf9f4 0%, var(--paper) 46%, var(--paper-2) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.95),
      inset 0 -1px 2px rgba(120,104,78,0.10),
      inset 0 0 0 1px rgba(255,255,255,0.5),
      0 1px 1px rgba(40,30,15,0.10),
      0 calc(var(--cw,200px)*0.018) calc(var(--cw,200px)*0.05) rgba(40,30,15,0.18);
  }
  .kc-card.down .kc-back::before{
    content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:3; --wv:calc(var(--cw,200px)*0.0235);
    background-image:
      repeating-linear-gradient(45deg, rgba(255,255,255,0.72) 0, rgba(255,255,255,0.72) calc(var(--wv)*0.16), transparent calc(var(--wv)*0.16), transparent calc(var(--wv)*0.5), rgba(122,104,74,0.17) calc(var(--wv)*0.5), rgba(122,104,74,0.17) calc(var(--wv)*0.66), transparent calc(var(--wv)*0.66), transparent var(--wv)),
      repeating-linear-gradient(-45deg, rgba(255,255,255,0.72) 0, rgba(255,255,255,0.72) calc(var(--wv)*0.16), transparent calc(var(--wv)*0.16), transparent calc(var(--wv)*0.5), rgba(122,104,74,0.17) calc(var(--wv)*0.5), rgba(122,104,74,0.17) calc(var(--wv)*0.66), transparent calc(var(--wv)*0.66), transparent var(--wv));
    opacity:.5;
  }
  .kc-back-field{
    position:absolute; inset:calc(var(--cw,200px)*0.055); border-radius:calc(var(--cw,200px)*0.03);
    background-image:
      repeating-linear-gradient(45deg,
        transparent 0 calc(var(--cw,200px)*0.058),
        rgba(86,71,46,0.16) calc(var(--cw,200px)*0.058) calc(var(--cw,200px)*0.063),
        rgba(255,255,255,0.7) calc(var(--cw,200px)*0.063) calc(var(--cw,200px)*0.069),
        transparent calc(var(--cw,200px)*0.069) calc(var(--cw,200px)*0.127)),
      repeating-linear-gradient(-45deg,
        transparent 0 calc(var(--cw,200px)*0.058),
        rgba(86,71,46,0.16) calc(var(--cw,200px)*0.058) calc(var(--cw,200px)*0.063),
        rgba(255,255,255,0.7) calc(var(--cw,200px)*0.063) calc(var(--cw,200px)*0.069),
        transparent calc(var(--cw,200px)*0.069) calc(var(--cw,200px)*0.127));
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.6),
      inset 0 0 0 1px rgba(150,134,104,0.10);
  }
  .kc-back-frame{
    position:absolute; inset:calc(var(--cw,200px)*0.04); border-radius:calc(var(--cw,200px)*0.03);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.7),
      inset 0 0 0 1px rgba(150,134,104,0.20),
      inset 0 2px 3px rgba(120,104,78,0.06);
    pointer-events:none;
  }
  `;

  function injectCSS() {
    if (document.getElementById("kc-styles")) return;
    const st = document.createElement("style");
    st.id = "kc-styles"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  injectCSS();

  /* ── helpers ──────────────────────────────────────────────────────────── */
  const SUIT_KEYS = ["S", "H", "D", "C"];
  function buildDeck() {
    const d = [];
    for (const s of SUIT_KEYS) for (let r = 1; r <= 13; r++) d.push({ rank: r, suit: s, id: s + r });
    return d;
  }

  window.KhonseraCards = { Card, Face, Back, Suit, buildDeck, SUIT_KEYS, SUIT_PATH, rankLabel };
})();
