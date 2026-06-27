/* ════════════════════════════════════════════════════════════════════════
 * Khonsera · Sudoku — a full game on the paper material.
 * Generator (full solution → symmetric dig) + state (givens / entries / notes
 * / mistakes), selection with peer + same-number highlight, pencil mode,
 * undo, erase, hint, per-number completion, win. Self-contained React.
 * ════════════════════════════════════════════════════════════════════════ */
const { useState, useEffect, useRef, useCallback } = React;

/* ── generator ─────────────────────────────────────────────────────────── */
const peersBox = (r, c) => [Math.floor(r / 3) * 3, Math.floor(c / 3) * 3];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

function canPlace(g, r, c, v) {
  for (let i = 0; i < 9; i++) { if (g[r * 9 + i] === v || g[i * 9 + c] === v) return false; }
  const [br, bc] = peersBox(r, c);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (g[(br + i) * 9 + (bc + j)] === v) return false;
  return true;
}
function solve(g) {
  const idx = g.indexOf(0);
  if (idx === -1) return true;
  const r = (idx / 9) | 0, c = idx % 9;
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(g, r, c, v)) { g[idx] = v; if (solve(g)) return true; g[idx] = 0; }
  }
  return false;
}
/* count solutions up to a cap (uniqueness check) */
function countSolutions(g, cap = 2) {
  const idx = g.indexOf(0);
  if (idx === -1) return 1;
  const r = (idx / 9) | 0, c = idx % 9; let n = 0;
  for (let v = 1; v <= 9; v++) {
    if (canPlace(g, r, c, v)) { g[idx] = v; n += countSolutions(g, cap); g[idx] = 0; if (n >= cap) break; }
  }
  return n;
}
function generate(holes) {
  const sol = new Array(81).fill(0); solve(sol);
  const puzzle = sol.slice();
  const cells = shuffle([...Array(81).keys()]);
  let removed = 0;
  for (const i of cells) {
    if (removed >= holes) break;
    const j = 80 - i; // symmetric partner
    const save = [puzzle[i], puzzle[j]];
    if (puzzle[i] === 0 && puzzle[j] === 0) continue;
    puzzle[i] = 0; puzzle[j] = 0;
    const test = puzzle.slice();
    if (countSolutions(test, 2) !== 1) { puzzle[i] = save[0]; puzzle[j] = save[1]; }
    else { removed += (i === j ? 1 : 2); }
  }
  return { sol, puzzle };
}

const LEVELS = { Easy: 40, Medium: 50, Hard: 56 };

/* ── icons ─────────────────────────────────────────────────────────────── */
const Ic = ({ d, size = 21, fill }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const IUndo = <Ic d={<><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-7L3 9" /></>} />;
const IErase = <Ic d={<><path d="M20 20H7L3 16a2 2 0 0 1 0-3l9-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8" /><path d="M9 12l5 5" /></>} />;
const IPencil = <Ic d={<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></>} />;
const IHint = <Ic d={<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></>} />;

/* ════════════════════════════════════════════════════════════════════════ */
function App() {
  const [level, setLevel] = useState("Easy");
  const [game, setGame] = useState(() => makeGame("Easy"));
  const [sel, setSel] = useState(null);          // selected index
  const [pencil, setPencil] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [secs, setSecs] = useState(0);
  const [won, setWon] = useState(false);
  const [flash, setFlash] = useState([]);        // indices flashing complete
  const hist = useRef([]);

  function makeGameInner(lv) { const { sol, puzzle } = generate(LEVELS[lv]); return { sol, puzzle, val: puzzle.slice(), notes: Array.from({ length: 81 }, () => new Set()) }; }
  function makeGame(lv) { return makeGameInner(lv); }

  const newGame = useCallback((lv) => {
    setGame(makeGameInner(lv)); setSel(null); setPencil(false);
    setMistakes(0); setSecs(0); setWon(false); setFlash([]); hist.current = [];
  }, []);

  // timer
  useEffect(() => { if (won) return; const t = setInterval(() => setSecs(s => s + 1), 1000); return () => clearInterval(t); }, [won]);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= "1" && e.key <= "9") enter(+e.key);
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
      else if (e.key === "n" || e.key === "N") setPencil(p => !p);
      else if (sel != null && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault(); let r = (sel / 9) | 0, c = sel % 9;
        if (e.key === "ArrowUp") r = (r + 8) % 9; if (e.key === "ArrowDown") r = (r + 1) % 9;
        if (e.key === "ArrowLeft") c = (c + 8) % 9; if (e.key === "ArrowRight") c = (c + 1) % 9;
        setSel(r * 9 + c);
      }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });

  const isGiven = (i) => game.puzzle[i] !== 0;

  function pushHist() { hist.current.push({ val: game.val.slice(), notes: game.notes.map(s => new Set(s)) }); if (hist.current.length > 80) hist.current.shift(); }

  function checkComplete(val, lastIdx) {
    // flash any row/col/box completed correctly by this move
    const r = (lastIdx / 9) | 0, c = lastIdx % 9, [br, bc] = peersBox(r, c);
    const units = [];
    const row = [], col = [], box = [];
    for (let k = 0; k < 9; k++) { row.push(r * 9 + k); col.push(k * 9 + c); }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) box.push((br + i) * 9 + (bc + j));
    [row, col, box].forEach(u => { if (u.every(ix => val[ix] !== 0 && val[ix] === game.sol[ix])) units.push(...u); });
    if (units.length) { setFlash(units); setTimeout(() => setFlash([]), 520); }
  }

  function enter(v) {
    if (sel == null || isGiven(sel) || won) return;
    if (pencil) {
      pushHist();
      const notes = game.notes.map(s => new Set(s));
      if (game.val[sel] === 0) { notes[sel].has(v) ? notes[sel].delete(v) : notes[sel].add(v); }
      setGame(g => ({ ...g, notes }));
      return;
    }
    pushHist();
    const val = game.val.slice(); val[sel] = (val[sel] === v ? 0 : v);
    const notes = game.notes.map(s => new Set(s)); notes[sel] = new Set();
    // clear this value from peer notes
    if (val[sel] !== 0) {
      const r = (sel / 9) | 0, c = sel % 9, [br, bc] = peersBox(r, c);
      for (let k = 0; k < 9; k++) { notes[r * 9 + k].delete(v); notes[k * 9 + c].delete(v); }
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) notes[(br + i) * 9 + (bc + j)].delete(v);
    }
    setGame(g => ({ ...g, val, notes }));
    if (val[sel] !== 0 && val[sel] !== game.sol[sel]) setMistakes(m => m + 1);
    else if (val[sel] !== 0) checkComplete(val, sel);
    if (val.every((x, i) => x === game.sol[i])) { setTimeout(() => setWon(true), 360); }
  }

  function erase() {
    if (sel == null || isGiven(sel) || won || (game.val[sel] === 0 && game.notes[sel].size === 0)) return;
    pushHist();
    const val = game.val.slice(); val[sel] = 0;
    const notes = game.notes.map(s => new Set(s)); notes[sel] = new Set();
    setGame(g => ({ ...g, val, notes }));
  }

  function undo() {
    const last = hist.current.pop(); if (!last) return;
    setGame(g => ({ ...g, val: last.val, notes: last.notes }));
  }

  function hint() {
    if (won) return;
    const empties = []; for (let i = 0; i < 81; i++) if (game.val[i] !== game.sol[i]) empties.push(i);
    if (!empties.length) return;
    const i = sel != null && game.val[sel] !== game.sol[sel] ? sel : empties[(Math.random() * empties.length) | 0];
    pushHist();
    const val = game.val.slice(); val[i] = game.sol[i];
    const notes = game.notes.map(s => new Set(s)); notes[i] = new Set();
    setGame(g => ({ ...g, val, notes })); setSel(i);
    checkComplete(val, i);
    if (val.every((x, k) => x === game.sol[k])) setTimeout(() => setWon(true), 360);
  }

  // per-number remaining counts
  const counts = new Array(10).fill(0);
  for (let i = 0; i < 81; i++) if (game.val[i]) counts[game.val[i]]++;

  const selVal = sel != null ? game.val[sel] : 0;
  const selR = sel != null ? (sel / 9) | 0 : -1, selC = sel != null ? sel % 9 : -1;
  const selBox = sel != null ? peersBox(selR, selC) : null;

  const mm = String((secs / 60) | 0).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="desk">
      <div className="stage">
        {/* header */}
        <div className="top">
          <div className="seg">
            {Object.keys(LEVELS).map(lv => (
              <button key={lv} data-active={level === lv} onClick={() => { setLevel(lv); newGame(lv); }}>{lv}</button>
            ))}
          </div>
          <div className="meta">
            <div className="stat"><span className="k">Errors</span><span className={"v" + (mistakes ? " warn" : "")}>{mistakes}</span></div>
            <div className="stat"><span className="k">Time</span><span className="v">{mm}:{ss}</span></div>
          </div>
        </div>

        {/* board */}
        <div className="board-wrap">
          <div className="board">
            {game.val.map((v, i) => {
              const r = (i / 9) | 0, c = i % 9;
              const given = isGiven(i);
              const wrong = v !== 0 && v !== game.sol[i] && !given;
              const isSel = sel === i;
              const peer = !isSel && sel != null && (r === selR || c === selC || (selBox && (Math.floor(r / 3) * 3 === selBox[0] && Math.floor(c / 3) * 3 === selBox[1])));
              const same = !isSel && v !== 0 && selVal !== 0 && v === selVal;
              const cls = ["cell", given ? "given" : "", wrong ? "wrong" : "", isSel ? "sel" : same ? "same" : peer ? "peer" : "", flash.includes(i) ? "flash" : ""].filter(Boolean).join(" ");
              return (
                <button key={i} className={cls} data-r={r} data-c={c} onClick={() => setSel(i)}>
                  {v !== 0
                    ? <span className="d" key={v}>{v}</span>
                    : (game.notes[i].size > 0 &&
                      <span className="notes">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                          <span key={n} className={selVal && n === selVal ? "hot" : ""}>{game.notes[i].has(n) ? n : ""}</span>
                        ))}
                      </span>)}
                </button>
              );
            })}
          </div>
        </div>

        {/* tools + pad */}
        <div className="lower">
          <div className="tools">
            <button className="tool" onClick={undo}><span className="ic">{IUndo}</span><span className="lb">Undo</span></button>
            <button className="tool" onClick={erase}><span className="ic">{IErase}</span><span className="lb">Erase</span></button>
            <button className="tool" data-on={pencil} onClick={() => setPencil(p => !p)}><span className="ic">{IPencil}</span><span className="lb">Notes</span></button>
            <button className="tool" onClick={hint}><span className="ic">{IHint}</span><span className="lb">Hint</span></button>
          </div>
          <div className="pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
              const done = counts[n] >= 9;
              return (
                <button key={n} className="key" data-done={done} onClick={() => enter(n)}>
                  {n}{!done && <span className="left">{9 - counts[n]}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* win */}
      <div className="scrim" data-show={won}>
        <div className="win">
          <div className="em">Solved · {level}</div>
          <h2>Clean sheet.</h2>
          <div className="sub">Every row, column and box accounts for.</div>
          <div className="stats">
            <div><div className="k">Time</div><div className="v">{mm}:{ss}</div></div>
            <div><div className="k">Errors</div><div className="v">{mistakes}</div></div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="ghost-btn" onClick={() => setWon(false)}>Review</button>
            <button className="ink-btn" onClick={() => newGame(level)}>New game</button>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
