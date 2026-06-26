import type { Route } from "next";

// The Pastimes catalogue — one entry per game. Driving the hub grid from this
// array keeps adding a future game (Sudoku, Crosswords, …) to a single line:
// give it a slug, a name, a one-line blurb, a stroke glyph, and `ready`. A live
// game links to `/pastimes/<slug>`; a not-yet-built one renders dimmed as "Soon".
export type GameGlyph = "cards" | "sudoku" | "crossword";

export type Game = {
  slug: string;
  name: string;
  blurb: string;
  icon: GameGlyph;
  ready: boolean;
};

export const GAMES: Game[] = [
  {
    slug: "solitaire",
    name: "Solitaire",
    blurb: "A quiet hand of Klondike.",
    icon: "cards",
    ready: true,
  },
  {
    slug: "sudoku",
    name: "Sudoku",
    blurb: "Numbers to settle into.",
    icon: "sudoku",
    ready: false,
  },
  {
    slug: "crosswords",
    name: "Crosswords",
    blurb: "A grid of small clues.",
    icon: "crossword",
    ready: false,
  },
];

export function gameHref(slug: string): Route {
  return `/pastimes/${slug}` as Route;
}

// Lucide-style single-path stroke glyphs (24-grid), drawn at the card head as a
// debossed letterpress mark via `.engr-ico`. Distinct from every nav glyph.
export const GAME_GLYPHS: Record<GameGlyph, string> = {
  // a fanned pair of playing cards
  cards: "M4 8a1 1 0 0 1 .7-1.3l7-2a1 1 0 0 1 1.2.7l3 11a1 1 0 0 1-.7 1.2l-7 2a1 1 0 0 1-1.2-.7z M9 5l7-2a1 1 0 0 1 1.2.7l3 11a1 1 0 0 1-.7 1.2l-2 .6",
  // a 9-cell grid
  sudoku: "M4 4h16v16H4z M4 9.3h16 M4 14.7h16 M9.3 4v16 M14.7 4v16",
  // crossword grid with two filled cells
  crossword: "M4 4h16v16H4z M4 9.3h16 M4 14.7h16 M9.3 4v16 M14.7 4v16 M4 4h5.3v5.3H4z M14.7 14.7H20V20h-5.3z",
};
