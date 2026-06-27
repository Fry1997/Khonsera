/* ============================================================================
 * Khonsera · Pastimes — the games tab
 * A quiet table for the in-between moments of a travel day. Lists the games,
 * keeps your personal bests, and shows the small circle you play against.
 * v7 paper: raised cotton sheets, letterpress-debossed ink, glyphs carved
 * into raised tiles, gold as punctuation only.
 * ========================================================================== */
const { useState } = React;

/* ── icons — thin, even stroke; carved into their tiles via .engr-ico ────── */
const I = {
  spade: (p) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" {...p}>
      <path d="M12 3C9.5 6.2 4.5 9.2 4.5 13.1c0 2.2 1.7 3.7 3.7 3.7 1 0 1.9-.4 2.5-1-.2 1.7-.9 3-2.2 3.9V21h7v-1.3c-1.3-.9-2-2.2-2.2-3.9.6.6 1.5 1 2.5 1 2 0 3.7-1.5 3.7-3.7C19.5 9.2 14.5 6.2 12 3Z"/>
    </svg>
  ),
  grid: (p) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.2"/>
      <path d="M9 3.6v16.8M15 3.6v16.8M3.6 9h16.8M3.6 15h16.8"/>
    </svg>
  ),
  cards: (p) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <rect x="3.4" y="6.2" width="10.4" height="14" rx="2" transform="rotate(-9 8.6 13.2)"/>
      <rect x="10.6" y="4.4" width="10.4" height="14" rx="2" transform="rotate(9 15.8 11.4)"/>
    </svg>
  ),
  today: (p) => (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <rect x="4" y="5" width="16" height="16" rx="2.4"/><path d="M4 9h16M8 3.5v3M16 3.5v3"/>
    </svg>
  ),
  plan: (p) => (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <circle cx="6" cy="6.5" r="1.8"/><circle cx="6" cy="17.5" r="1.8"/><path d="M6 8.3v7.4M11 6.5h8M11 17.5h8"/>
    </svg>
  ),
  wallet: (p) => (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <rect x="3.5" y="6" width="17" height="13" rx="2.4"/><path d="M3.5 10h17M16 14.5h1.5"/>
    </svg>
  ),
  play: (p) => (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <circle cx="8" cy="9" r="3.2"/><circle cx="16.2" cy="15.4" r="3.2"/>
    </svg>
  ),
  chevron: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 6l6 6-6 6"/>
    </svg>
  ),
  trophy: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4ZM7 5H4.5v1.5A2.5 2.5 0 0 0 7 9M17 5h2.5v1.5A2.5 2.5 0 0 1 17 9M9.5 13.5h5M12 12v1.5M8.5 20h7M10 17h4l.5 3h-5Z"/>
    </svg>
  ),
  plus: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M12 6v12M6 12h12"/>
    </svg>
  ),
};

/* ── data ─────────────────────────────────────────────────────────────── */
const GAMES = [
  { id: "solitaire", href: "../../Solitaire.html", icon: "spade", name: "Solitaire",
    line: "Klondike · draw three",
    bestK: "Best time", bestV: "2:47",
    stats: [["Won", "36"], ["Win rate", "64%"]] },
  { id: "sudoku", href: "../sudoku/Sudoku.html", icon: "grid", name: "Sudoku",
    line: "Hard",
    bestK: "Best time", bestV: "4:12",
    stats: [["Solved", "38"], ["Average", "5:30"]] },
  { id: "gin", href: "../gin-rummy/GinRummy.html", icon: "cards", name: "Gin Rummy",
    line: "First to 100",
    bestK: "Record", bestV: "12–9",
    stats: [["Win rate", "57%"], ["Gins", "5"]] },
];

const CIRCLE = [
  { initials: "MR", name: "Maya Rao",      tint: "slate", line: "Sudoku · Hard",  stat: "3:58", beat: true },
  { initials: "JT", name: "James Tan",     tint: "sage",  line: "Gin Rummy",      stat: "+2",   beat: false },
  { initials: "EА", name: "Elif Akın",     tint: "plum",  line: "Solitaire",      stat: "2:31", beat: true },
  { initials: "DC", name: "Dawid Czerný",  tint: "terra", line: "Played 2h ago",  stat: "—",    beat: false },
];

/* friends — all-time wins */
const BOARD = [
  { rank: 1, name: "Elif",  pts: 41, you: false },
  { rank: 2, name: "You",   pts: 38, you: true },
  { rank: 3, name: "Maya",  pts: 33, you: false },
  { rank: 4, name: "James", pts: 27, you: false },
];

function StatStrip() {
  const items = [["Played", "107"], ["Won", "61"], ["Win rate", "57%"]];
  return (
    <div className="statstrip card-soft">
      {items.map(([k, v], i) => (
        <React.Fragment key={k}>
          {i > 0 && <span className="ss-div" />}
          <div className="ss">
            <span className="ss-k">{k}</span>
            <span className="ss-v engr">{v}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function GameCard({ g }) {
  return (
    <a className="game card" href={g.href}>
      <div className="game-ic"><span className="engr-ico">{I[g.icon]()}</span></div>
      <div className="game-body">
        <div className="game-head">
          <span className="game-name">{g.name}</span>
        </div>
        <span className="game-line">{g.line}</span>
        <div className="game-stats">
          <div className="gs gs-lead">
            <span className="gs-k">{g.bestK}</span>
            <span className="gs-v engr">{g.bestV}</span>
          </div>
          {g.stats.map(([k, v]) => (
            <div className="gs" key={k}>
              <span className="gs-k">{k}</span>
              <span className="gs-v engr">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <span className="game-go"><I.chevron /></span>
    </a>
  );
}

function FriendRow({ f }) {
  return (
    <div className="friend">
      <span className={"avatar tint-" + f.tint}><span className="engr-ico-d av-i">{f.initials}</span></span>
      <div className="friend-body">
        <span className="friend-name">{f.name}</span>
        <span className="friend-line">{f.line}</span>
      </div>
      {f.stat !== "—" && (
        <span className={"friend-stat mono" + (f.beat ? " beat" : "")}>{f.stat}</span>
      )}
    </div>
  );
}

function Leaderboard() {
  return (
    <div className="board card">
      <div className="board-head">
        <span className="eyebrow">Among friends</span>
        <span className="board-sub small dim">Wins, all time</span>
      </div>
      <div className="board-rows">
        {BOARD.map((r) => (
          <div className={"brow" + (r.you ? " me" : "")} key={r.name}>
            <span className="brank mono">{r.rank}</span>
            <span className="bname">{r.name}</span>
            <span className="bbar"><span className="bfill" style={{ width: (r.pts / 41 * 100) + "%" }} /></span>
            <span className="bpts engr mono">{r.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Nav() {
  const tabs = [["today", "Today"], ["plan", "Plan"], ["wallet", "Wallet"], ["play", "Pastimes"]];
  return (
    <nav className="tabbar">
      {tabs.map(([icon, label]) => {
        const active = icon === "play";
        return (
          <button className={"tab" + (active ? " active" : "")} key={icon}>
            <span className="tab-ic">{I[icon]({ className: active ? "engr-ico-d" : "engr-ico" })}</span>
            <span className="tab-lb">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Pastimes() {
  return (
    <div className="desk">
      <div className="stage">
        <header className="phead">
          <div className="brand-lockup">
            <span className="bl-dot" />
            <span className="bl-wm">Khonsera</span>
          </div>
          <button className="icon-button">{I.plus()}</button>
        </header>

        <div className="scroll">
          <div className="titleblock">
            <span className="eyebrow">Pastimes</span>
            <h1 className="h1">The table</h1>
            <p className="standfirst">Something for the gate, the platform, the seat. Your bests and your circle, kept between journeys.</p>
          </div>

          <StatStrip />

          <div className="flank left sect">Games</div>
          <div className="games">
            {GAMES.map((g) => <GameCard key={g.id} g={g} />)}
          </div>

          <div className="flank left sect">Your circle</div>
          <div className="circle card">
            {CIRCLE.map((f, i) => (
              <React.Fragment key={f.name}>
                {i > 0 && <span className="fr-div" />}
                <FriendRow f={f} />
              </React.Fragment>
            ))}
            <button className="invite btn btn-ghost btn-full">Invite someone</button>
          </div>

          <div className="flank left sect"><I.trophy /> <span style={{ marginLeft: 6 }}>Standings</span></div>
          <Leaderboard />

          <div className="footnote tiny dim">Scores stay on your device. Your circle sees only what you share.</div>
        </div>

        <Nav />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Pastimes />);
