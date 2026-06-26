import type { Metadata } from "next";
import Link from "next/link";
import { requireUserContext } from "@/lib/auth";
import { GAMES, GAME_GLYPHS, gameHref, type Game } from "./games";
import "./pastimes.css";

// Pastimes — a calm hub for low-anxiety downtime games: somewhere wholesome to
// put your hands while the miles pass, the deliberate alternative to the scroll.
// Server component on the app's paper surface (cotton/light), gated by the (app)
// shell auth like every other screen. The game grid is driven entirely by the
// `GAMES` array (games.ts), so a new pastime is one entry there — never a markup
// change here. Live games link; not-yet-built ones render dimmed as "Soon".
export const metadata: Metadata = {
  title: "Pastimes",
};

export default async function PastimesPage() {
  // Keep the (app)-group auth/access gate applied.
  await requireUserContext();

  return (
    <div className="cc-screen pastimes-screen">
      <header className="pastimes-head">
        <span className="cc-eyebrow">A quiet corner</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>Pastimes</h1>
        <p className="pastimes-intro engr">
          Somewhere quiet to put your hands while the miles pass.
        </p>
      </header>

      <ul className="pastimes-grid" role="list">
        {GAMES.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </ul>
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const inner = (
    <>
      <span className="pastime-ico engr-ico" aria-hidden>
        <Glyph d={GAME_GLYPHS[game.icon]} />
      </span>
      <span className="pastime-body">
        <span className="pastime-name engr">{game.name}</span>
        <span className="pastime-blurb">{game.blurb}</span>
      </span>
      <span className={`pastime-state${game.ready ? "" : " is-soon"}`}>
        {game.ready ? "Play" : "Soon"}
      </span>
    </>
  );

  if (!game.ready) {
    return (
      <li>
        <div className="pg pastime-card is-soon" aria-disabled="true">
          {inner}
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link href={gameHref(game.slug)} className="pg pastime-card">
        {inner}
      </Link>
    </li>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
