import type { Metadata } from "next";
import Link from "next/link";
import { requireUserContext } from "@/lib/auth";
import { GAMES, GAME_GLYPHS, gameHref, type Game } from "./games";
import "./pastimes.css";

// Pastimes — a calm hub for low-anxiety downtime games: somewhere wholesome to
// put your hands while the miles pass, the deliberate alternative to the scroll.
// Server component on the app's paper surface (cotton/light), gated by the (app)
// shell auth like every other screen. Recomposed to the approved "Pastimes / The
// table" handoff: a title block (eyebrow · headline · standfirst), a "Games"
// section flank, then the raised game tiles. The grid is driven entirely by the
// `GAMES` array (games.ts), so a new pastime is one entry there — never a markup
// change here. Live games link; not-yet-built ones render dimmed with a "Soon"
// pill, no pointer.
export const metadata: Metadata = {
  title: "Pastimes",
};

export default async function PastimesPage() {
  // Keep the (app)-group auth/access gate applied.
  await requireUserContext();

  return (
    <div className="cc-screen pastimes-screen">
      <header className="pastimes-head">
        <span className="cc-eyebrow pastimes-eyebrow">Pastimes</span>
        <h1 className="cc-screen-title pastimes-title">The table</h1>
        <p className="cc-standfirst pastimes-standfirst">
          Something for the gate, the platform, the seat. A quiet hand to play
          while the miles pass.
        </p>
      </header>

      <section className="pastimes-section" aria-labelledby="pastimes-games-flank">
        <h2 id="pastimes-games-flank" className="pastimes-flank">
          Games
        </h2>
        <ul className="pastimes-grid" role="list">
          {GAMES.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </ul>
      </section>

      <p className="pastimes-footnote">
        Each game plays offline. Nothing here needs signal.
      </p>
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
      {game.ready ? (
        <span className="pastime-go" aria-hidden>
          <Chevron />
        </span>
      ) : (
        <span className="pastime-state is-soon">Soon</span>
      )}
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

function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
